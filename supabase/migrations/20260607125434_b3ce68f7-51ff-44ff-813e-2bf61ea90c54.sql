
-- Private calls: 1:1 video/audio calls between mutual followers
CREATE TABLE public.private_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id uuid NOT NULL,
  callee_id uuid NOT NULL,
  room_id text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('video','audio')),
  status text NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing','accepted','declined','missed','ended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  ended_at timestamptz
);

CREATE INDEX private_calls_callee_status_idx ON public.private_calls(callee_id, status, created_at DESC);
CREATE INDEX private_calls_caller_status_idx ON public.private_calls(caller_id, status, created_at DESC);

GRANT SELECT, UPDATE ON public.private_calls TO authenticated;
GRANT ALL ON public.private_calls TO service_role;

ALTER TABLE public.private_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pc read involved" ON public.private_calls
  FOR SELECT TO authenticated
  USING (auth.uid() = caller_id OR auth.uid() = callee_id);

-- Updates only via RPC; restrict direct updates to involved parties (RPCs are SECURITY DEFINER and bypass)
CREATE POLICY "pc no direct update" ON public.private_calls
  FOR UPDATE TO authenticated
  USING (false);

-- Add to realtime publication so callee gets ringing INSERT instantly
ALTER PUBLICATION supabase_realtime ADD TABLE public.private_calls;

-- Mutual followers list
CREATE OR REPLACE FUNCTION public.mutual_followers()
RETURNS TABLE(user_id uuid, display_name text, username text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.user_id, p.display_name, p.username, p.avatar_url
  FROM public.follows f1
  JOIN public.follows f2
    ON f1.followee_id = f2.follower_id
   AND f1.follower_id = f2.followee_id
  JOIN public.profiles p ON p.user_id = f1.followee_id
  WHERE f1.follower_id = auth.uid()
  ORDER BY p.display_name NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION public.is_mutual_follow(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.follows WHERE follower_id = p_a AND followee_id = p_b
  ) AND EXISTS (
    SELECT 1 FROM public.follows WHERE follower_id = p_b AND followee_id = p_a
  );
$$;

CREATE OR REPLACE FUNCTION public.start_private_call(p_callee uuid, p_mode text DEFAULT 'video')
RETURNS public.private_calls
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.private_calls;
  v_room text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF v_uid = p_callee THEN RAISE EXCEPTION 'cannot call self'; END IF;
  IF p_mode NOT IN ('video','audio') THEN p_mode := 'video'; END IF;
  IF NOT public.is_mutual_follow(v_uid, p_callee) THEN
    RAISE EXCEPTION 'mutual follow required';
  END IF;

  -- end any prior active calls between these users
  UPDATE public.private_calls
     SET status = 'ended', ended_at = now()
   WHERE status IN ('ringing','accepted')
     AND ((caller_id = v_uid AND callee_id = p_callee) OR (caller_id = p_callee AND callee_id = v_uid));

  v_room := 'pc-' || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO public.private_calls(caller_id, callee_id, room_id, mode)
  VALUES (v_uid, p_callee, v_room, p_mode)
  RETURNING * INTO v_row;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.respond_private_call(p_call_id uuid, p_accept boolean)
RETURNS public.private_calls
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.private_calls;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO v_row FROM public.private_calls WHERE id = p_call_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'call not found'; END IF;
  IF v_row.callee_id <> v_uid THEN RAISE EXCEPTION 'only callee can respond'; END IF;
  IF v_row.status <> 'ringing' THEN RETURN v_row; END IF;
  IF p_accept THEN
    UPDATE public.private_calls SET status = 'accepted', answered_at = now()
      WHERE id = p_call_id RETURNING * INTO v_row;
  ELSE
    UPDATE public.private_calls SET status = 'declined', ended_at = now()
      WHERE id = p_call_id RETURNING * INTO v_row;
  END IF;
  RETURN v_row;
END $$;

CREATE OR REPLACE FUNCTION public.end_private_call(p_call_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_uid uuid := auth.uid(); v_row public.private_calls;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO v_row FROM public.private_calls WHERE id = p_call_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_uid <> v_row.caller_id AND v_uid <> v_row.callee_id THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_row.status IN ('ended','declined','missed') THEN RETURN; END IF;
  UPDATE public.private_calls
     SET status = CASE WHEN status = 'ringing' THEN 'missed' ELSE 'ended' END,
         ended_at = now()
   WHERE id = p_call_id;
END $$;
