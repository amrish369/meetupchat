
-- =========================================
-- 1. Friend DMs
-- =========================================
CREATE TABLE public.friend_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  text text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fm_pair ON public.friend_messages(LEAST(sender_id,receiver_id), GREATEST(sender_id,receiver_id), created_at DESC);
CREATE INDEX idx_fm_receiver ON public.friend_messages(receiver_id, read_at);

GRANT SELECT, INSERT, UPDATE ON public.friend_messages TO authenticated;
GRANT ALL ON public.friend_messages TO service_role;
ALTER TABLE public.friend_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fm read involved" ON public.friend_messages FOR SELECT TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "fm insert as sender" ON public.friend_messages FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND sender_id <> receiver_id
  AND NOT EXISTS (SELECT 1 FROM public.blocks WHERE blocker_id = receiver_id AND blocked_id = sender_id)
);

CREATE POLICY "fm mark read as receiver" ON public.friend_messages FOR UPDATE TO authenticated
USING (auth.uid() = receiver_id) WITH CHECK (auth.uid() = receiver_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_messages;

-- =========================================
-- 2. Referrals
-- =========================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by uuid;

CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_id uuid NOT NULL UNIQUE,
  code text NOT NULL,
  reward_coins integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ref_referrer ON public.referrals(referrer_id);

GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrals involved read" ON public.referrals FOR SELECT TO authenticated
USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

-- Backfill codes for existing users
UPDATE public.profiles SET referral_code = upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))
  WHERE referral_code IS NULL;

-- Auto-generate referral code on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, referral_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $$;

-- Redeem referral code (called once by referred user)
CREATE OR REPLACE FUNCTION public.redeem_referral(p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_referrer uuid;
  v_existing uuid;
  v_reward integer := 50;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT referred_by INTO v_existing FROM public.profiles WHERE user_id = v_uid;
  IF v_existing IS NOT NULL THEN RAISE EXCEPTION 'already redeemed'; END IF;
  SELECT user_id INTO v_referrer FROM public.profiles WHERE referral_code = upper(p_code);
  IF v_referrer IS NULL THEN RAISE EXCEPTION 'invalid code'; END IF;
  IF v_referrer = v_uid THEN RAISE EXCEPTION 'cannot use own code'; END IF;

  UPDATE public.profiles SET referred_by = v_referrer, coins = coins + v_reward, updated_at = now() WHERE user_id = v_uid;
  UPDATE public.profiles SET coins = coins + v_reward, updated_at = now() WHERE user_id = v_referrer;
  INSERT INTO public.referrals(referrer_id, referred_id, code, reward_coins) VALUES (v_referrer, v_uid, upper(p_code), v_reward);
  INSERT INTO public.coins_ledger(user_id, delta, reason) VALUES (v_uid, v_reward, 'referral_redeemed'), (v_referrer, v_reward, 'referral_bonus');
  RETURN jsonb_build_object('ok', true, 'coins_awarded', v_reward);
END $$;

-- =========================================
-- 3. Achievements
-- =========================================
CREATE TABLE public.achievements (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  reward_coins integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.achievements TO anon, authenticated;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achievements public read" ON public.achievements FOR SELECT USING (true);

CREATE TABLE public.user_achievements (
  user_id uuid NOT NULL,
  achievement_code text NOT NULL REFERENCES public.achievements(code),
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_code)
);
GRANT SELECT ON public.user_achievements TO authenticated;
GRANT ALL ON public.user_achievements TO service_role;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ua own read" ON public.user_achievements FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ua public read" ON public.user_achievements FOR SELECT TO anon USING (false);

-- Seed achievements
INSERT INTO public.achievements(code, name, description, icon, reward_coins, sort_order) VALUES
  ('first_match', 'Ice Breaker', 'Complete your first match', '🎯', 20, 1),
  ('streak_3', 'On Fire', 'Maintain a 3-day check-in streak', '🔥', 30, 2),
  ('streak_7', 'Week Warrior', 'Maintain a 7-day streak', '⚡', 75, 3),
  ('coins_500', 'Coin Collector', 'Accumulate 500 coins', '💰', 50, 4),
  ('friends_5', 'Social Butterfly', 'Follow 5 people', '🦋', 40, 5),
  ('premium', 'VIP Member', 'Become a premium user', '👑', 100, 6),
  ('referrer', 'Influencer', 'Refer your first friend', '📣', 50, 7);

-- Award achievement (idempotent)
CREATE OR REPLACE FUNCTION public.award_achievement(p_user uuid, p_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_reward integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_achievements WHERE user_id = p_user AND achievement_code = p_code) THEN
    RETURN false;
  END IF;
  SELECT reward_coins INTO v_reward FROM public.achievements WHERE code = p_code;
  IF v_reward IS NULL THEN RETURN false; END IF;
  INSERT INTO public.user_achievements(user_id, achievement_code) VALUES (p_user, p_code);
  UPDATE public.profiles SET coins = coins + v_reward, updated_at = now() WHERE user_id = p_user;
  INSERT INTO public.coins_ledger(user_id, delta, reason) VALUES (p_user, v_reward, 'achievement:'||p_code);
  RETURN true;
END $$;

-- Check & award based on current profile state
CREATE OR REPLACE FUNCTION public.check_achievements()
RETURNS TABLE(code text, awarded boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid(); v_p record; v_follow_count int; v_ref_count int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO v_p FROM public.profiles WHERE user_id = v_uid;
  SELECT count(*) INTO v_follow_count FROM public.follows WHERE follower_id = v_uid;
  SELECT count(*) INTO v_ref_count FROM public.referrals WHERE referrer_id = v_uid;

  IF v_p.streak_days >= 3 THEN code := 'streak_3'; awarded := public.award_achievement(v_uid, 'streak_3'); RETURN NEXT; END IF;
  IF v_p.streak_days >= 7 THEN code := 'streak_7'; awarded := public.award_achievement(v_uid, 'streak_7'); RETURN NEXT; END IF;
  IF v_p.coins >= 500 THEN code := 'coins_500'; awarded := public.award_achievement(v_uid, 'coins_500'); RETURN NEXT; END IF;
  IF v_follow_count >= 5 THEN code := 'friends_5'; awarded := public.award_achievement(v_uid, 'friends_5'); RETURN NEXT; END IF;
  IF v_p.is_premium THEN code := 'premium'; awarded := public.award_achievement(v_uid, 'premium'); RETURN NEXT; END IF;
  IF v_ref_count >= 1 THEN code := 'referrer'; awarded := public.award_achievement(v_uid, 'referrer'); RETURN NEXT; END IF;
END $$;

-- =========================================
-- 4. Gift shop
-- =========================================
CREATE TABLE public.gifts (
  code text PRIMARY KEY,
  name text NOT NULL,
  emoji text NOT NULL,
  price_coins integer NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.gifts TO anon, authenticated;
GRANT ALL ON public.gifts TO service_role;
ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gifts public read" ON public.gifts FOR SELECT USING (true);

INSERT INTO public.gifts(code, name, emoji, price_coins, sort_order) VALUES
  ('rose', 'Rose', '🌹', 10, 1),
  ('heart', 'Heart', '❤️', 25, 2),
  ('star', 'Star', '⭐', 50, 3),
  ('diamond', 'Diamond', '💎', 100, 4),
  ('crown', 'Crown', '👑', 250, 5),
  ('rocket', 'Rocket', '🚀', 500, 6);

CREATE TABLE public.gift_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  gift_code text NOT NULL REFERENCES public.gifts(code),
  coins_spent integer NOT NULL,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_gt_receiver ON public.gift_transactions(receiver_id, created_at DESC);
CREATE INDEX idx_gt_sender ON public.gift_transactions(sender_id, created_at DESC);

GRANT SELECT ON public.gift_transactions TO authenticated;
GRANT ALL ON public.gift_transactions TO service_role;
ALTER TABLE public.gift_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gt involved read" ON public.gift_transactions FOR SELECT TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Send gift RPC
CREATE OR REPLACE FUNCTION public.send_gift(p_receiver uuid, p_gift_code text, p_message text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_uid uuid := auth.uid(); v_price int; v_balance int; v_receiver_share int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF v_uid = p_receiver THEN RAISE EXCEPTION 'cannot gift self'; END IF;
  SELECT price_coins INTO v_price FROM public.gifts WHERE code = p_gift_code;
  IF v_price IS NULL THEN RAISE EXCEPTION 'invalid gift'; END IF;
  SELECT coins INTO v_balance FROM public.profiles WHERE user_id = v_uid FOR UPDATE;
  IF v_balance < v_price THEN RAISE EXCEPTION 'insufficient coins'; END IF;

  v_receiver_share := (v_price * 50 / 100);
  UPDATE public.profiles SET coins = coins - v_price, updated_at = now() WHERE user_id = v_uid;
  UPDATE public.profiles SET coins = coins + v_receiver_share, updated_at = now() WHERE user_id = p_receiver;
  INSERT INTO public.gift_transactions(sender_id, receiver_id, gift_code, coins_spent, message)
    VALUES (v_uid, p_receiver, p_gift_code, v_price, p_message);
  INSERT INTO public.coins_ledger(user_id, delta, reason) VALUES
    (v_uid, -v_price, 'gift_sent:'||p_gift_code),
    (p_receiver, v_receiver_share, 'gift_received:'||p_gift_code);
  RETURN jsonb_build_object('ok', true, 'spent', v_price, 'received', v_receiver_share);
END $$;

-- =========================================
-- 5. Country leaderboard helper
-- =========================================
CREATE OR REPLACE FUNCTION public.country_leaderboard(p_country text)
RETURNS TABLE(user_id uuid, display_name text, username text, avatar_url text, coins integer, streak_days integer, is_premium boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT user_id, display_name, username, avatar_url, coins, streak_days, is_premium
  FROM public.profiles
  WHERE country = p_country
  ORDER BY coins DESC, streak_days DESC
  LIMIT 50;
$$;

-- =========================================
-- 6. Friend conversation list helper
-- =========================================
CREATE OR REPLACE FUNCTION public.friend_conversations()
RETURNS TABLE(peer_id uuid, display_name text, username text, avatar_url text, last_text text, last_at timestamptz, unread integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH msgs AS (
    SELECT
      CASE WHEN sender_id = auth.uid() THEN receiver_id ELSE sender_id END AS peer,
      text, created_at, sender_id, receiver_id, read_at
    FROM public.friend_messages
    WHERE sender_id = auth.uid() OR receiver_id = auth.uid()
  ),
  latest AS (
    SELECT DISTINCT ON (peer) peer, text, created_at FROM msgs ORDER BY peer, created_at DESC
  ),
  unread_counts AS (
    SELECT sender_id AS peer, count(*)::int AS c FROM public.friend_messages
    WHERE receiver_id = auth.uid() AND read_at IS NULL GROUP BY sender_id
  )
  SELECT l.peer, p.display_name, p.username, p.avatar_url, l.text, l.created_at, COALESCE(u.c, 0)
  FROM latest l
  JOIN public.profiles p ON p.user_id = l.peer
  LEFT JOIN unread_counts u ON u.peer = l.peer
  ORDER BY l.created_at DESC;
$$;
