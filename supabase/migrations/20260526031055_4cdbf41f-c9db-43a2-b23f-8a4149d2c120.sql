
-- ───────────────────────── profiles ─────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  gender text CHECK (gender IN ('male','female','other')),
  region text,
  is_premium boolean NOT NULL DEFAULT false,
  premium_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles select own" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "profiles insert own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles update own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_set_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────── payment_submissions ───────────────────
CREATE TABLE IF NOT EXISTS public.payment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'monthly',
  amount_inr integer NOT NULL,
  upi_reference text,
  screenshot_path text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewer_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

ALTER TABLE public.payment_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pay select own" ON public.payment_submissions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "pay insert own pending" ON public.payment_submissions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- ─────────────────── storage bucket ───────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "payment proofs upload own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "payment proofs read own"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ─────────── match_queue: add filter columns ───────────
ALTER TABLE public.match_queue
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS filter_gender text,
  ADD COLUMN IF NOT EXISTS filter_region text,
  ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false;

-- ─────────── updated request_match with filters ───────────
DROP FUNCTION IF EXISTS public.request_match(text);

CREATE OR REPLACE FUNCTION public.request_match(
  p_session_id text,
  p_gender text DEFAULT NULL,
  p_region text DEFAULT NULL,
  p_filter_gender text DEFAULT NULL,
  p_filter_region text DEFAULT NULL,
  p_is_premium boolean DEFAULT false
)
RETURNS TABLE(status text, match_id uuid, room_id text, peer_session text, is_caller boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_peer text;
  v_room text;
  v_match_id uuid;
BEGIN
  -- premium-only filters
  IF NOT p_is_premium THEN
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
    SELECT session_id FROM public.match_queue
    WHERE session_id <> p_session_id
      AND heartbeat_at > now() - interval '30 seconds'
      AND (p_filter_gender IS NULL OR gender = p_filter_gender)
      AND (p_filter_region IS NULL OR region = p_filter_region)
      AND (filter_gender IS NULL OR filter_gender = p_gender)
      AND (filter_region IS NULL OR filter_region = p_region)
    ORDER BY joined_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  DELETE FROM public.match_queue q USING cte
  WHERE q.session_id = cte.session_id
  RETURNING q.session_id INTO v_peer;

  IF v_peer IS NULL THEN
    INSERT INTO public.match_queue
      (session_id, joined_at, heartbeat_at, gender, region, filter_gender, filter_region, is_premium)
    VALUES
      (p_session_id, now(), now(), p_gender, p_region, p_filter_gender, p_filter_region, p_is_premium)
    ON CONFLICT (session_id) DO UPDATE SET
      heartbeat_at = now(),
      gender = EXCLUDED.gender,
      region = EXCLUDED.region,
      filter_gender = EXCLUDED.filter_gender,
      filter_region = EXCLUDED.filter_region,
      is_premium = EXCLUDED.is_premium;

    RETURN QUERY SELECT 'queued'::text, NULL::uuid, NULL::text, NULL::text, NULL::boolean;
    RETURN;
  END IF;

  v_room := replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  INSERT INTO public.matches (room_id, session_a, session_b, caller)
  VALUES (v_room, LEAST(p_session_id, v_peer), GREATEST(p_session_id, v_peer), p_session_id)
  RETURNING id INTO v_match_id;

  RETURN QUERY SELECT 'matched'::text, v_match_id, v_room, v_peer, true::boolean;
END;
$function$;
