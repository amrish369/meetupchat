-- Keep matchmaking fast and avoid stale matches blocking new connections
CREATE INDEX IF NOT EXISTS idx_match_queue_fresh_fifo
  ON public.match_queue (heartbeat_at DESC, joined_at ASC);

CREATE INDEX IF NOT EXISTS idx_matches_session_a_active
  ON public.matches (session_a, created_at DESC)
  WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_matches_session_b_active
  ON public.matches (session_b, created_at DESC)
  WHERE ended_at IS NULL;

-- Ensure match inserts are broadcast to waiting clients.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'matches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
  END IF;
END $$;

-- Close stale active matches that are clearly abandoned.
UPDATE public.matches
SET ended_at = now()
WHERE ended_at IS NULL
  AND created_at < now() - interval '10 minutes';

CREATE OR REPLACE FUNCTION public.request_match(p_session_id text)
 RETURNS TABLE(status text, match_id uuid, room_id text, peer_session text, is_caller boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_peer text;
  v_room text;
  v_match_id uuid;
  v_caller text;
BEGIN
  -- Remove old queue rows and close any abandoned active match for this tab.
  DELETE FROM public.match_queue
  WHERE heartbeat_at < now() - interval '60 seconds'
     OR session_id = p_session_id;

  UPDATE public.matches
  SET ended_at = now()
  WHERE ended_at IS NULL
    AND (session_a = p_session_id OR session_b = p_session_id);

  -- Atomically grab the oldest fresh peer. SKIP LOCKED prevents double matches.
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
    INSERT INTO public.match_queue (session_id, joined_at, heartbeat_at)
    VALUES (p_session_id, now(), now())
    ON CONFLICT (session_id) DO UPDATE
      SET heartbeat_at = now();

    RETURN QUERY SELECT 'queued'::text, NULL::uuid, NULL::text, NULL::text, NULL::boolean;
    RETURN;
  END IF;

  v_room := encode(gen_random_bytes(12), 'hex');
  -- The user who gets matched immediately should initiate the offer. This
  -- avoids relying on lexicographic session ordering and reduces deadlocks.
  v_caller := p_session_id;

  INSERT INTO public.matches (room_id, session_a, session_b, caller)
  VALUES (v_room, LEAST(p_session_id, v_peer), GREATEST(p_session_id, v_peer), v_caller)
  RETURNING id INTO v_match_id;

  RETURN QUERY SELECT
    'matched'::text,
    v_match_id,
    v_room,
    v_peer,
    true::boolean;
END;
$function$;