
-- ============ Extend profiles ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coins integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trust_score integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS streak_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_checkin date;

-- ============ Coins ledger ============
CREATE TABLE IF NOT EXISTS public.coins_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  delta integer NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coins_ledger TO authenticated;
GRANT ALL ON public.coins_ledger TO service_role;
ALTER TABLE public.coins_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger own select" ON public.coins_ledger FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_coins_ledger_user ON public.coins_ledger(user_id, created_at DESC);

-- ============ Daily check-ins ============
CREATE TABLE IF NOT EXISTS public.daily_checkins (
  user_id uuid NOT NULL,
  checkin_date date NOT NULL,
  coins_awarded integer NOT NULL,
  streak_after integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, checkin_date)
);
GRANT SELECT ON public.daily_checkins TO authenticated;
GRANT ALL ON public.daily_checkins TO service_role;
ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checkin own" ON public.daily_checkins FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============ Spin history ============
CREATE TABLE IF NOT EXISTS public.spin_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  prize_coins integer NOT NULL,
  prize_label text NOT NULL,
  spun_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.spin_history TO authenticated;
GRANT ALL ON public.spin_history TO service_role;
ALTER TABLE public.spin_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spin own" ON public.spin_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_spin_user_day ON public.spin_history(user_id, spun_at DESC);

-- ============ Follows ============
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid NOT NULL,
  followee_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follows read involved" ON public.follows FOR SELECT TO authenticated
  USING (auth.uid() = follower_id OR auth.uid() = followee_id);
CREATE POLICY "follows insert self" ON public.follows FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows delete self" ON public.follows FOR DELETE TO authenticated
  USING (auth.uid() = follower_id);

-- ============ Blocks ============
CREATE TABLE IF NOT EXISTS public.blocks (
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.blocks TO authenticated;
GRANT ALL ON public.blocks TO service_role;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "blocks own select" ON public.blocks FOR SELECT TO authenticated USING (auth.uid() = blocker_id);
CREATE POLICY "blocks insert self" ON public.blocks FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "blocks delete self" ON public.blocks FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

-- ============ Profile visitors ============
CREATE TABLE IF NOT EXISTS public.profile_visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  visited_at timestamptz NOT NULL DEFAULT now(),
  CHECK (visitor_id <> profile_id)
);
GRANT SELECT ON public.profile_visitors TO authenticated;
GRANT ALL ON public.profile_visitors TO service_role;
ALTER TABLE public.profile_visitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visitors own profile" ON public.profile_visitors FOR SELECT TO authenticated USING (auth.uid() = profile_id);
CREATE INDEX IF NOT EXISTS idx_visitors_profile ON public.profile_visitors(profile_id, visited_at DESC);

-- ============ Rooms ============
CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text,
  emoji text,
  is_official boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rooms TO anon, authenticated;
GRANT INSERT ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms public read" ON public.rooms FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "rooms create authed" ON public.rooms FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE TABLE IF NOT EXISTS public.room_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text,
  text text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.room_messages TO authenticated;
GRANT ALL ON public.room_messages TO service_role;
ALTER TABLE public.room_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "room msgs read authed" ON public.room_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "room msgs insert self" ON public.room_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_room_msgs_room ON public.room_messages(room_id, created_at DESC);
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;

-- ============ Seed default rooms ============
INSERT INTO public.rooms (slug, name, description, category, emoji, is_official) VALUES
  ('india-chat',    'India Chat',       'Chat with people from across India',     'Region',    '🇮🇳', true),
  ('coding-hub',    'Coding Hub',       'Devs, hackers, and tech enthusiasts',    'Tech',      '💻', true),
  ('study-room',    'Study Room',       'Focus together, share notes, grow',      'Education', '📚', true),
  ('startup-founders','Startup Founders','Builders, founders, and operators',     'Business',  '🚀', true),
  ('cricket-fans',  'Cricket Fans',     'Live match talk, predictions, banter',   'Sports',    '🏏', true),
  ('music-lovers',  'Music Lovers',     'Share what you''re listening to',         'Music',     '🎵', true),
  ('anime-community','Anime Community',  'Anime, manga & otaku talk',              'Anime',     '🍥', true)
ON CONFLICT (slug) DO NOTHING;

-- ============ RPCs ============

-- Daily check-in
CREATE OR REPLACE FUNCTION public.claim_daily_checkin()
RETURNS TABLE(awarded integer, streak integer, balance integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_last date;
  v_today date := (now() at time zone 'utc')::date;
  v_streak integer;
  v_award integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT last_checkin, streak_days INTO v_last, v_streak FROM public.profiles WHERE user_id = v_uid FOR UPDATE;
  IF v_last = v_today THEN
    RETURN QUERY SELECT 0, COALESCE(v_streak,0), (SELECT coins FROM public.profiles WHERE user_id = v_uid);
    RETURN;
  END IF;
  IF v_last = v_today - 1 THEN
    v_streak := COALESCE(v_streak,0) + 1;
  ELSE
    v_streak := 1;
  END IF;
  -- award: 10 + 5*streak capped 50
  v_award := LEAST(10 + 5 * v_streak, 60);
  UPDATE public.profiles
    SET coins = coins + v_award, streak_days = v_streak, last_checkin = v_today, updated_at = now()
    WHERE user_id = v_uid;
  INSERT INTO public.daily_checkins(user_id, checkin_date, coins_awarded, streak_after)
    VALUES (v_uid, v_today, v_award, v_streak);
  INSERT INTO public.coins_ledger(user_id, delta, reason) VALUES (v_uid, v_award, 'daily_checkin');
  RETURN QUERY SELECT v_award, v_streak, (SELECT coins FROM public.profiles WHERE user_id = v_uid);
END $$;

-- Spin the wheel (1 free per day)
CREATE OR REPLACE FUNCTION public.spin_wheel()
RETURNS TABLE(prize integer, label text, balance integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_last timestamptz;
  v_prize integer;
  v_label text;
  v_r integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT MAX(spun_at) INTO v_last FROM public.spin_history WHERE user_id = v_uid;
  IF v_last IS NOT NULL AND v_last > (now() - interval '24 hours') THEN
    RAISE EXCEPTION 'Already spun in last 24h';
  END IF;
  v_r := floor(random() * 100)::int;
  IF v_r < 40 THEN v_prize := 5;   v_label := '+5 coins';
  ELSIF v_r < 70 THEN v_prize := 15; v_label := '+15 coins';
  ELSIF v_r < 90 THEN v_prize := 30; v_label := '+30 coins';
  ELSIF v_r < 98 THEN v_prize := 75; v_label := '+75 coins';
  ELSE v_prize := 200; v_label := 'JACKPOT +200!';
  END IF;
  UPDATE public.profiles SET coins = coins + v_prize, updated_at = now() WHERE user_id = v_uid;
  INSERT INTO public.spin_history(user_id, prize_coins, prize_label) VALUES (v_uid, v_prize, v_label);
  INSERT INTO public.coins_ledger(user_id, delta, reason) VALUES (v_uid, v_prize, 'spin_wheel');
  RETURN QUERY SELECT v_prize, v_label, (SELECT coins FROM public.profiles WHERE user_id = v_uid);
END $$;

-- Record profile visit (rate-limited to 1 per visitor-profile per 24h)
CREATE OR REPLACE FUNCTION public.record_profile_visit(p_profile_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR v_uid = p_profile_id THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.profile_visitors WHERE visitor_id = v_uid AND profile_id = p_profile_id AND visited_at > now() - interval '24 hours') THEN
    RETURN;
  END IF;
  INSERT INTO public.profile_visitors(visitor_id, profile_id) VALUES (v_uid, p_profile_id);
END $$;

-- Global leaderboard (coins-based, top 50)
CREATE OR REPLACE FUNCTION public.global_leaderboard()
RETURNS TABLE(user_id uuid, display_name text, username text, avatar_url text, coins integer, streak_days integer, is_premium boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id, display_name, username, avatar_url, coins, streak_days, is_premium
  FROM public.profiles
  ORDER BY coins DESC, streak_days DESC
  LIMIT 50;
$$;

-- Public profile lookup (safe columns only)
CREATE OR REPLACE FUNCTION public.public_profile(p_user_id uuid)
RETURNS TABLE(user_id uuid, display_name text, username text, bio text, avatar_url text, interests text[], region text, is_premium boolean, coins integer, streak_days integer, trust_score integer, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id, display_name, username, bio, avatar_url, interests, region, is_premium, coins, streak_days, trust_score, created_at
  FROM public.profiles WHERE user_id = p_user_id;
$$;

-- Replace request_match to add interest-overlap priority
CREATE OR REPLACE FUNCTION public.request_match(
  p_session_id text,
  p_gender text DEFAULT NULL,
  p_region text DEFAULT NULL,
  p_filter_gender text DEFAULT NULL,
  p_filter_region text DEFAULT NULL,
  p_is_premium boolean DEFAULT false,
  p_interests text[] DEFAULT NULL
) RETURNS TABLE(status text, match_id uuid, room_id text, peer_session text, is_caller boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_peer text;
  v_room text;
  v_match_id uuid;
BEGIN
  IF NOT p_is_premium THEN
    p_filter_gender := NULL;
    p_filter_region := NULL;
  END IF;

  DELETE FROM public.match_queue
  WHERE heartbeat_at < now() - interval '60 seconds'
     OR session_id = p_session_id;

  UPDATE public.matches SET ended_at = now()
  WHERE ended_at IS NULL
    AND (session_a = p_session_id OR session_b = p_session_id);

  WITH cte AS (
    SELECT session_id,
      CASE WHEN p_interests IS NULL OR interests IS NULL THEN 0
           ELSE cardinality(ARRAY(SELECT unnest(interests) INTERSECT SELECT unnest(p_interests)))
      END AS overlap
    FROM public.match_queue
    WHERE session_id <> p_session_id
      AND heartbeat_at > now() - interval '30 seconds'
      AND (p_filter_gender IS NULL OR gender = p_filter_gender)
      AND (p_filter_region IS NULL OR region = p_filter_region)
      AND (filter_gender IS NULL OR filter_gender = p_gender)
      AND (filter_region IS NULL OR filter_region = p_region)
    ORDER BY overlap DESC, joined_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  DELETE FROM public.match_queue q USING cte
  WHERE q.session_id = cte.session_id
  RETURNING q.session_id INTO v_peer;

  IF v_peer IS NULL THEN
    INSERT INTO public.match_queue
      (session_id, joined_at, heartbeat_at, gender, region, filter_gender, filter_region, is_premium, interests)
    VALUES
      (p_session_id, now(), now(), p_gender, p_region, p_filter_gender, p_filter_region, p_is_premium, p_interests)
    ON CONFLICT (session_id) DO UPDATE SET
      heartbeat_at = now(),
      gender = EXCLUDED.gender,
      region = EXCLUDED.region,
      filter_gender = EXCLUDED.filter_gender,
      filter_region = EXCLUDED.filter_region,
      is_premium = EXCLUDED.is_premium,
      interests = EXCLUDED.interests;
    RETURN QUERY SELECT 'queued'::text, NULL::uuid, NULL::text, NULL::text, NULL::boolean;
    RETURN;
  END IF;

  v_room := replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  INSERT INTO public.matches (room_id, session_a, session_b, caller)
  VALUES (v_room, LEAST(p_session_id, v_peer), GREATEST(p_session_id, v_peer), p_session_id)
  RETURNING id INTO v_match_id;
  RETURN QUERY SELECT 'matched'::text, v_match_id, v_room, v_peer, true::boolean;
END $$;

-- Add interests column to match_queue
ALTER TABLE public.match_queue ADD COLUMN IF NOT EXISTS interests text[];
