CREATE OR REPLACE FUNCTION public.end_match(p_room_id text, p_session_id text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE public.matches
  SET ended_at = now()
  WHERE room_id = p_room_id
    AND ended_at IS NULL
    AND (session_a = p_session_id OR session_b = p_session_id);
$function$;

REVOKE ALL ON FUNCTION public.end_match(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.end_match(text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.request_match(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.heartbeat_queue(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.leave_queue(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_stale_queue() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.online_count() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.request_match(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.heartbeat_queue(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leave_queue(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.online_count() TO anon, authenticated;