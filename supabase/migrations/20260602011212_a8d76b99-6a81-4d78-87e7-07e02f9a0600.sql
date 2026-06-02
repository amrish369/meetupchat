
-- 1) Lock down end_match: revoke anon, verify caller participates and is authenticated
REVOKE EXECUTE ON FUNCTION public.end_match(text, text) FROM anon, public;

CREATE OR REPLACE FUNCTION public.end_match(p_room_id text, p_session_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  UPDATE public.matches
    SET ended_at = now()
    WHERE room_id = p_room_id
      AND ended_at IS NULL
      AND (session_a = p_session_id OR session_b = p_session_id);
END $$;

GRANT EXECUTE ON FUNCTION public.end_match(text, text) TO authenticated;

-- 2) request_match: derive premium from DB, ignore client flag
CREATE OR REPLACE FUNCTION public.request_match(
  p_session_id text,
  p_gender text DEFAULT NULL::text,
  p_region text DEFAULT NULL::text,
  p_filter_gender text DEFAULT NULL::text,
  p_filter_region text DEFAULT NULL::text,
  p_is_premium boolean DEFAULT false,
  p_interests text[] DEFAULT NULL::text[]
)
RETURNS TABLE(status text, match_id uuid, room_id text, peer_session text, is_caller boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_peer text;
  v_room text;
  v_match_id uuid;
  v_uid uuid := auth.uid();
  v_is_premium boolean := false;
BEGIN
  -- Authoritative premium check from DB; ignore client value
  IF v_uid IS NOT NULL THEN
    SELECT (is_premium AND (premium_until IS NULL OR premium_until > now()))
      INTO v_is_premium
      FROM public.profiles WHERE user_id = v_uid;
    v_is_premium := COALESCE(v_is_premium, false);
  END IF;

  IF NOT v_is_premium THEN
    p_filter_gender := NULL;
    p_filter_region := NULL;
  END IF;

  DELETE FROM public.match_queue
  WHERE heartbeat_at < now() - interval '60 seconds'
     OR session_id = p_session_id;

  UPDATE public.matches SET ended_at = now()
  WHERE ended_at IS NULL
    AND (session_a = p_session_id OR session_b = p_session_id);

  WITH cte AS (
    SELECT session_id,
      CASE WHEN p_interests IS NULL OR interests IS NULL THEN 0
           ELSE cardinality(ARRAY(SELECT unnest(interests) INTERSECT SELECT unnest(p_interests)))
      END AS overlap
    FROM public.match_queue
    WHERE session_id <> p_session_id
      AND heartbeat_at > now() - interval '30 seconds'
      AND (p_filter_gender IS NULL OR gender = p_filter_gender)
      AND (p_filter_region IS NULL OR region = p_filter_region)
      AND (filter_gender IS NULL OR filter_gender = p_gender)
      AND (filter_region IS NULL OR filter_region = p_region)
    ORDER BY overlap DESC, joined_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  DELETE FROM public.match_queue q USING cte
  WHERE q.session_id = cte.session_id
  RETURNING q.session_id INTO v_peer;

  IF v_peer IS NULL THEN
    INSERT INTO public.match_queue
      (session_id, joined_at, heartbeat_at, gender, region, filter_gender, filter_region, is_premium, interests)
    VALUES
      (p_session_id, now(), now(), p_gender, p_region, p_filter_gender, p_filter_region, v_is_premium, p_interests)
    ON CONFLICT (session_id) DO UPDATE SET
      heartbeat_at = now(),
      gender = EXCLUDED.gender,
      region = EXCLUDED.region,
      filter_gender = EXCLUDED.filter_gender,
      filter_region = EXCLUDED.filter_region,
      is_premium = EXCLUDED.is_premium,
      interests = EXCLUDED.interests;
    RETURN QUERY SELECT 'queued'::text, NULL::uuid, NULL::text, NULL::text, NULL::boolean;
    RETURN;
  END IF;

  v_room := replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  INSERT INTO public.matches (room_id, session_a, session_b, caller)
  VALUES (v_room, LEAST(p_session_id, v_peer), GREATEST(p_session_id, v_peer), p_session_id)
  RETURNING id INTO v_match_id;
  RETURN QUERY SELECT 'matched'::text, v_match_id, v_room, v_peer, true::boolean;
END $$;

-- 3) Avatars bucket + policies
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
DROP POLICY IF EXISTS "avatars upload own" ON storage.objects;
DROP POLICY IF EXISTS "avatars update own" ON storage.objects;
DROP POLICY IF EXISTS "avatars delete own" ON storage.objects;

CREATE POLICY "avatars public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars upload own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars update own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 4) Tighten always-true INSERT policies with basic validation
DROP POLICY IF EXISTS "Anyone can join waitlist" ON public.waitlist;
CREATE POLICY "Anyone can join waitlist"
  ON public.waitlist FOR INSERT TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL
    AND char_length(email) BETWEEN 5 AND 255
    AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  );

DROP POLICY IF EXISTS "Anyone can submit reports" ON public.reports;
CREATE POLICY "Anyone can submit reports"
  ON public.reports FOR INSERT TO anon, authenticated
  WITH CHECK (
    reason IS NOT NULL
    AND char_length(reason) BETWEEN 1 AND 200
    AND char_length(reporter_session) BETWEEN 1 AND 128
    AND char_length(reported_session) BETWEEN 1 AND 128
    AND (details IS NULL OR char_length(details) <= 2000)
  );
