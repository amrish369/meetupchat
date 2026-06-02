
-- Match history for current session id (matches table has deny-read RLS, so expose via SECURITY DEFINER RPC)
CREATE OR REPLACE FUNCTION public.my_match_history(p_session_id text, p_limit int DEFAULT 50, p_offset int DEFAULT 0)
RETURNS TABLE(id uuid, room_id text, peer_session text, started_at timestamptz, ended_at timestamptz, duration_sec int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, room_id,
    CASE WHEN session_a = p_session_id THEN session_b ELSE session_a END AS peer_session,
    created_at AS started_at, ended_at,
    COALESCE(EXTRACT(EPOCH FROM (ended_at - created_at))::int, 0) AS duration_sec
  FROM public.matches
  WHERE session_a = p_session_id OR session_b = p_session_id
  ORDER BY created_at DESC
  LIMIT GREATEST(p_limit,1) OFFSET GREATEST(p_offset,0);
$$;

-- Activity (coin ledger) paginated for current user
CREATE OR REPLACE FUNCTION public.my_activity(p_limit int DEFAULT 50, p_offset int DEFAULT 0)
RETURNS TABLE(id uuid, delta int, reason text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, delta, reason, created_at FROM public.coins_ledger
  WHERE user_id = auth.uid()
  ORDER BY created_at DESC
  LIMIT GREATEST(p_limit,1) OFFSET GREATEST(p_offset,0);
$$;

-- Profile visitors paginated for current user (joined with visitor profile basics)
CREATE OR REPLACE FUNCTION public.my_visitors(p_limit int DEFAULT 50, p_offset int DEFAULT 0)
RETURNS TABLE(id uuid, visitor_id uuid, display_name text, username text, avatar_url text, visited_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.id, v.visitor_id, p.display_name, p.username, p.avatar_url, v.visited_at
  FROM public.profile_visitors v
  LEFT JOIN public.profiles p ON p.user_id = v.visitor_id
  WHERE v.profile_id = auth.uid()
  ORDER BY v.visited_at DESC
  LIMIT GREATEST(p_limit,1) OFFSET GREATEST(p_offset,0);
$$;

REVOKE EXECUTE ON FUNCTION public.my_match_history(text,int,int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.my_match_history(text,int,int) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.my_activity(int,int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.my_activity(int,int) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.my_visitors(int,int) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.my_visitors(int,int) TO authenticated;
