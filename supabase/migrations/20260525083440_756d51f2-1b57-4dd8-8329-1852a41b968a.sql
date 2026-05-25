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

  -- Use UUID-derived randomness because gen_random_uuid() is already available
  -- in this project, while gen_random_bytes() may not be exposed.
  v_room := replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
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