-- 1. Column-level revoke: block direct writes to server-managed columns
REVOKE UPDATE (coins, is_premium, premium_until, plan, trust_score, banned_until,
  is_adult, age_verified_at, referred_by, referral_code, last_checkin, streak_days)
  ON public.profiles FROM authenticated;
REVOKE INSERT (coins, is_premium, premium_until, plan, trust_score, banned_until,
  is_adult, age_verified_at, referred_by, referral_code, last_checkin, streak_days)
  ON public.profiles FROM authenticated;

-- 2. Defensive trigger: re-assert old values if a client somehow writes them
CREATE OR REPLACE FUNCTION public.profiles_guard_protected_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    NEW.coins           := OLD.coins;
    NEW.is_premium      := OLD.is_premium;
    NEW.premium_until   := OLD.premium_until;
    NEW.plan            := OLD.plan;
    NEW.trust_score     := OLD.trust_score;
    NEW.banned_until    := OLD.banned_until;
    NEW.is_adult        := OLD.is_adult;
    NEW.age_verified_at := OLD.age_verified_at;
    NEW.date_of_birth   := OLD.date_of_birth;
    NEW.referred_by     := OLD.referred_by;
    NEW.referral_code   := OLD.referral_code;
    NEW.last_checkin    := OLD.last_checkin;
    NEW.streak_days     := OLD.streak_days;
    NEW.user_id         := OLD.user_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_guard_protected ON public.profiles;
CREATE TRIGGER profiles_guard_protected
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_protected_columns();