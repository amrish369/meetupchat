DROP POLICY IF EXISTS "queue insert all" ON public.match_queue;
DROP POLICY IF EXISTS "queue update all" ON public.match_queue;
DROP POLICY IF EXISTS "queue delete all" ON public.match_queue;

DROP POLICY IF EXISTS "matches insert all" ON public.matches;
DROP POLICY IF EXISTS "matches update all" ON public.matches;