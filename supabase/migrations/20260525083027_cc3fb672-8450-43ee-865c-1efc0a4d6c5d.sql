CREATE OR REPLACE FUNCTION public.online_count()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH live_sessions AS (
    SELECT session_id
    FROM public.match_queue
    WHERE heartbeat_at > now() - interval '30 seconds'

    UNION

    SELECT session_a AS session_id
    FROM public.matches
    WHERE ended_at IS NULL
      AND created_at > now() - interval '10 minutes'

    UNION

    SELECT session_b AS session_id
    FROM public.matches
    WHERE ended_at IS NULL
      AND created_at > now() - interval '10 minutes'
  )
  SELECT COUNT(*)::int FROM live_sessions;
$function$;