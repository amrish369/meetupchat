
-- Restrict overly permissive SELECT policies on session/match data

-- BANS: deny all client reads; ban checks should go through a SECURITY DEFINER RPC if needed
DROP POLICY IF EXISTS "Anyone can read bans for self-check" ON public.bans;
CREATE POLICY "bans no direct read" ON public.bans FOR SELECT TO anon, authenticated USING (false);

CREATE OR REPLACE FUNCTION public.is_session_banned(p_session_id text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bans
    WHERE session_id = p_session_id
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;
REVOKE ALL ON FUNCTION public.is_session_banned(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_session_banned(text) TO anon, authenticated;

-- MATCH_QUEUE: deny direct client reads (all queue ops go through SECURITY DEFINER RPCs)
DROP POLICY IF EXISTS "queue read all" ON public.match_queue;
CREATE POLICY "queue no direct read" ON public.match_queue FOR SELECT TO anon, authenticated USING (false);

-- MATCHES: deny direct client reads, expose via RPC scoped to caller's session
DROP POLICY IF EXISTS "matches read all" ON public.matches;
CREATE POLICY "matches no direct read" ON public.matches FOR SELECT TO anon, authenticated USING (false);

CREATE OR REPLACE FUNCTION public.find_active_match(p_session_id text)
RETURNS TABLE(match_id uuid, room_id text, peer_session text, is_caller boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    id AS match_id,
    room_id,
    CASE WHEN session_a = p_session_id THEN session_b ELSE session_a END AS peer_session,
    (caller = p_session_id) AS is_caller
  FROM public.matches
  WHERE ended_at IS NULL
    AND (session_a = p_session_id OR session_b = p_session_id)
  ORDER BY created_at DESC
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.find_active_match(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_active_match(text) TO anon, authenticated;
