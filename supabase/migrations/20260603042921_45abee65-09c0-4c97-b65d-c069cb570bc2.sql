
-- Chat request / permission system
CREATE TABLE IF NOT EXISTS public.chat_threads (
  user_a uuid NOT NULL,
  user_b uuid NOT NULL,
  requester_id uuid NOT NULL,
  accepted boolean NOT NULL DEFAULT false,
  declined boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  PRIMARY KEY (user_a, user_b),
  CHECK (user_a < user_b)
);

GRANT SELECT, INSERT, UPDATE ON public.chat_threads TO authenticated;
GRANT ALL ON public.chat_threads TO service_role;

ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ct read involved" ON public.chat_threads FOR SELECT TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);

-- inserts/updates only via SECURITY DEFINER RPCs below
CREATE POLICY "ct no direct write" ON public.chat_threads FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "ct no direct update" ON public.chat_threads FOR UPDATE TO authenticated USING (false);

CREATE OR REPLACE FUNCTION public.can_send_friend_message(p_sender uuid, p_receiver uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_a uuid := LEAST(p_sender, p_receiver);
  v_b uuid := GREATEST(p_sender, p_receiver);
  v_thread record;
  v_sent_count int;
BEGIN
  IF p_sender = p_receiver THEN RETURN false; END IF;
  -- blocked either way?
  IF EXISTS (SELECT 1 FROM public.blocks WHERE (blocker_id = p_sender AND blocked_id = p_receiver) OR (blocker_id = p_receiver AND blocked_id = p_sender)) THEN
    RETURN false;
  END IF;
  SELECT * INTO v_thread FROM public.chat_threads WHERE user_a = v_a AND user_b = v_b;
  IF v_thread.accepted THEN RETURN true; END IF;
  IF v_thread.declined THEN RETURN false; END IF;
  -- pending: sender can send up to 3 messages until receiver responds
  -- only the original requester is limited; if other side replies, that auto-accepts
  IF v_thread.user_a IS NULL THEN
    -- no thread yet; sender becomes requester, allow 1st msg
    RETURN true;
  END IF;
  -- if current sender is NOT the requester, they're replying → auto-accept allowed
  IF v_thread.requester_id <> p_sender THEN
    RETURN true;
  END IF;
  -- sender IS requester and still pending
  SELECT count(*) INTO v_sent_count FROM public.friend_messages
    WHERE sender_id = p_sender AND receiver_id = p_receiver;
  RETURN v_sent_count < 3;
END $$;

GRANT EXECUTE ON FUNCTION public.can_send_friend_message(uuid,uuid) TO authenticated;

-- After-insert trigger: create/auto-accept thread
CREATE OR REPLACE FUNCTION public.friend_message_after_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_a uuid := LEAST(NEW.sender_id, NEW.receiver_id);
  v_b uuid := GREATEST(NEW.sender_id, NEW.receiver_id);
  v_thread record;
BEGIN
  SELECT * INTO v_thread FROM public.chat_threads WHERE user_a = v_a AND user_b = v_b;
  IF NOT FOUND THEN
    INSERT INTO public.chat_threads(user_a, user_b, requester_id) VALUES (v_a, v_b, NEW.sender_id);
  ELSIF NOT v_thread.accepted AND v_thread.requester_id <> NEW.sender_id THEN
    UPDATE public.chat_threads SET accepted = true, accepted_at = now()
      WHERE user_a = v_a AND user_b = v_b;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_friend_message_after_insert ON public.friend_messages;
CREATE TRIGGER trg_friend_message_after_insert
AFTER INSERT ON public.friend_messages
FOR EACH ROW EXECUTE FUNCTION public.friend_message_after_insert();

-- Replace insert policy to enforce gating
DROP POLICY IF EXISTS "fm insert as sender" ON public.friend_messages;
CREATE POLICY "fm insert gated" ON public.friend_messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND sender_id <> receiver_id
  AND public.can_send_friend_message(sender_id, receiver_id)
);

-- Respond to chat request
CREATE OR REPLACE FUNCTION public.respond_chat_request(p_peer uuid, p_accept boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_a uuid;
  v_b uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF v_uid = p_peer THEN RAISE EXCEPTION 'invalid peer'; END IF;
  v_a := LEAST(v_uid, p_peer);
  v_b := GREATEST(v_uid, p_peer);
  -- only receiver (non-requester) can respond
  IF NOT EXISTS (SELECT 1 FROM public.chat_threads WHERE user_a = v_a AND user_b = v_b AND requester_id <> v_uid) THEN
    RAISE EXCEPTION 'no pending request';
  END IF;
  IF p_accept THEN
    UPDATE public.chat_threads SET accepted = true, declined = false, accepted_at = now()
      WHERE user_a = v_a AND user_b = v_b;
  ELSE
    UPDATE public.chat_threads SET declined = true, accepted = false
      WHERE user_a = v_a AND user_b = v_b;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.respond_chat_request(uuid,boolean) TO authenticated;

-- Status helper for UI
CREATE OR REPLACE FUNCTION public.chat_thread_status(p_peer uuid)
RETURNS TABLE(accepted boolean, declined boolean, requester_id uuid, sent_count int, remaining int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_a uuid := LEAST(v_uid, p_peer);
  v_b uuid := GREATEST(v_uid, p_peer);
  v_t record;
  v_sent int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO v_t FROM public.chat_threads WHERE user_a = v_a AND user_b = v_b;
  SELECT count(*) INTO v_sent FROM public.friend_messages WHERE sender_id = v_uid AND receiver_id = p_peer;
  IF NOT FOUND THEN
    accepted := false; declined := false; requester_id := NULL; sent_count := v_sent; remaining := 3;
  ELSE
    accepted := v_t.accepted;
    declined := v_t.declined;
    requester_id := v_t.requester_id;
    sent_count := v_sent;
    IF v_t.accepted THEN remaining := 999;
    ELSIF v_t.requester_id = v_uid THEN remaining := GREATEST(3 - v_sent, 0);
    ELSE remaining := 999;
    END IF;
  END IF;
  RETURN NEXT;
END $$;

GRANT EXECUTE ON FUNCTION public.chat_thread_status(uuid) TO authenticated;

-- Gift recipients: union of my followers + following with profile info
CREATE OR REPLACE FUNCTION public.gift_recipients()
RETURNS TABLE(user_id uuid, display_name text, username text, avatar_url text, relation text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH ids AS (
    SELECT followee_id AS uid, 'following'::text AS rel FROM public.follows WHERE follower_id = auth.uid()
    UNION
    SELECT follower_id AS uid, 'follower'::text AS rel FROM public.follows WHERE followee_id = auth.uid()
  ),
  ranked AS (
    SELECT uid, MIN(rel) AS rel FROM ids GROUP BY uid
  )
  SELECT p.user_id, p.display_name, p.username, p.avatar_url, r.rel
  FROM ranked r
  JOIN public.profiles p ON p.user_id = r.uid
  ORDER BY p.display_name NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.gift_recipients() TO authenticated;
