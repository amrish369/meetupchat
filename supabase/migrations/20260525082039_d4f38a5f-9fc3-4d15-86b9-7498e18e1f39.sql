
-- Queue of users currently looking for a match
CREATE TABLE public.match_queue (
  session_id text PRIMARY KEY,
  joined_at timestamptz NOT NULL DEFAULT now(),
  heartbeat_at timestamptz NOT NULL DEFAULT now(),
  region text
);

CREATE INDEX idx_match_queue_joined ON public.match_queue (joined_at);
CREATE INDEX idx_match_queue_heartbeat ON public.match_queue (heartbeat_at);

ALTER TABLE public.match_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "queue read all" ON public.match_queue FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "queue insert all" ON public.match_queue FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "queue update all" ON public.match_queue FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "queue delete all" ON public.match_queue FOR DELETE TO anon, authenticated USING (true);

-- Confirmed pairings
CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  session_a text NOT NULL,
  session_b text NOT NULL,
  caller text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE INDEX idx_matches_session_a ON public.matches (session_a);
CREATE INDEX idx_matches_session_b ON public.matches (session_b);
CREATE INDEX idx_matches_room ON public.matches (room_id);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matches read all" ON public.matches FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "matches insert all" ON public.matches FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "matches update all" ON public.matches FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER TABLE public.matches REPLICA IDENTITY FULL;

-- Atomic match request: pops the oldest fresh peer (SKIP LOCKED → O(1) hot path)
-- and creates a match row. If no peer is available, enqueues the caller.
CREATE OR REPLACE FUNCTION public.request_match(p_session_id text)
RETURNS TABLE (
  status text,
  match_id uuid,
  room_id text,
  peer_session text,
  is_caller boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_peer text;
  v_room text;
  v_match_id uuid;
  v_caller text;
BEGIN
  -- Evict caller's stale row first
  DELETE FROM public.match_queue WHERE session_id = p_session_id;

  -- Atomically grab one fresh peer ahead of us. SKIP LOCKED ensures
  -- concurrent callers each grab DIFFERENT rows → no double-matching.
  WITH cte AS (
    SELECT session_id
    FROM public.match_queue
    WHERE session_id <> p_session_id
      AND heartbeat_at > now() - interval '30 seconds'
    ORDER BY joined_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  DELETE FROM public.match_queue q USING cte
  WHERE q.session_id = cte.session_id
  RETURNING q.session_id INTO v_peer;

  IF v_peer IS NULL THEN
    -- No peer available → enqueue self
    INSERT INTO public.match_queue (session_id) VALUES (p_session_id);
    RETURN QUERY SELECT 'queued'::text, NULL::uuid, NULL::text, NULL::text, NULL::boolean;
    RETURN;
  END IF;

  v_room := encode(gen_random_bytes(12), 'hex');
  v_caller := LEAST(p_session_id, v_peer);

  INSERT INTO public.matches (room_id, session_a, session_b, caller)
  VALUES (v_room, LEAST(p_session_id, v_peer), GREATEST(p_session_id, v_peer), v_caller)
  RETURNING id INTO v_match_id;

  RETURN QUERY SELECT
    'matched'::text,
    v_match_id,
    v_room,
    v_peer,
    (v_caller = p_session_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.heartbeat_queue(p_session_id text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.match_queue SET heartbeat_at = now() WHERE session_id = p_session_id;
$$;

CREATE OR REPLACE FUNCTION public.leave_queue(p_session_id text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.match_queue WHERE session_id = p_session_id;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_stale_queue()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.match_queue WHERE heartbeat_at < now() - interval '60 seconds';
$$;

CREATE OR REPLACE FUNCTION public.online_count()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COUNT(*)::int FROM public.match_queue WHERE heartbeat_at > now() - interval '30 seconds';
$$;

GRANT EXECUTE ON FUNCTION public.request_match(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.heartbeat_queue(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leave_queue(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_queue() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_count() TO anon, authenticated;
