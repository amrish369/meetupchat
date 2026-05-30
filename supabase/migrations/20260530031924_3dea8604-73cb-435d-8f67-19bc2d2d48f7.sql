
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS banned_until timestamptz,
  ADD COLUMN IF NOT EXISTS country text;

-- Admin logs
CREATE TABLE public.admin_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  action text NOT NULL,
  target_user_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_logs TO authenticated;
GRANT ALL ON public.admin_logs TO service_role;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read logs" ON public.admin_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Support tickets
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  status text NOT NULL DEFAULT 'open',
  admin_reply text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tickets own select" ON public.support_tickets FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "tickets own insert" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tickets admin update" ON public.support_tickets FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to read profiles/reports/payments via policies (for dashboard via RPC we'll use SECURITY DEFINER, but extra policies help)
CREATE POLICY "admins read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins read payments" ON public.payment_submissions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update payments" ON public.payment_submissions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ===== Admin RPCs =====
CREATE OR REPLACE FUNCTION public.admin_grant_plan(p_user uuid, p_plan text, p_days integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin uuid := auth.uid(); v_base timestamptz;
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF p_plan NOT IN ('free','premium','gold','platinum') THEN RAISE EXCEPTION 'invalid plan'; END IF;
  IF p_plan = 'free' THEN
    UPDATE public.profiles SET plan='free', is_premium=false, premium_until=NULL, updated_at=now() WHERE user_id=p_user;
  ELSE
    SELECT GREATEST(COALESCE(premium_until, now()), now()) INTO v_base FROM public.profiles WHERE user_id=p_user;
    UPDATE public.profiles
      SET plan=p_plan, is_premium=true,
          premium_until = v_base + make_interval(days => GREATEST(p_days,1)),
          updated_at=now()
      WHERE user_id=p_user;
  END IF;
  INSERT INTO public.admin_logs(admin_id, action, target_user_id, details)
    VALUES (v_admin, 'grant_plan', p_user, jsonb_build_object('plan',p_plan,'days',p_days));
END $$;

CREATE OR REPLACE FUNCTION public.admin_adjust_coins(p_user uuid, p_delta integer, p_reason text DEFAULT 'admin')
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin uuid := auth.uid(); v_new integer;
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles SET coins = GREATEST(coins + p_delta, 0), updated_at = now()
    WHERE user_id = p_user RETURNING coins INTO v_new;
  INSERT INTO public.coins_ledger(user_id, delta, reason) VALUES (p_user, p_delta, p_reason);
  INSERT INTO public.admin_logs(admin_id, action, target_user_id, details)
    VALUES (v_admin, 'adjust_coins', p_user, jsonb_build_object('delta',p_delta,'reason',p_reason));
  RETURN v_new;
END $$;

CREATE OR REPLACE FUNCTION public.admin_ban_user(p_user uuid, p_days integer, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles SET banned_until = now() + make_interval(days => GREATEST(p_days,1)), updated_at=now()
    WHERE user_id = p_user;
  INSERT INTO public.admin_logs(admin_id, action, target_user_id, details)
    VALUES (v_admin, 'ban_user', p_user, jsonb_build_object('days',p_days,'reason',p_reason));
END $$;

CREATE OR REPLACE FUNCTION public.admin_unban_user(p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.profiles SET banned_until = NULL, updated_at=now() WHERE user_id = p_user;
  INSERT INTO public.admin_logs(admin_id, action, target_user_id) VALUES (v_admin, 'unban_user', p_user);
END $$;

CREATE OR REPLACE FUNCTION public.admin_approve_payment(p_submission uuid, p_plan text, p_days integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin uuid := auth.uid(); v_user uuid; v_status text;
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT user_id, status INTO v_user, v_status FROM public.payment_submissions WHERE id = p_submission FOR UPDATE;
  IF v_user IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF v_status <> 'pending' THEN RAISE EXCEPTION 'already processed'; END IF;
  UPDATE public.payment_submissions SET status='approved', reviewed_at=now(), reviewer_note=concat('plan=',p_plan,' days=',p_days) WHERE id = p_submission;
  PERFORM public.admin_grant_plan(v_user, p_plan, p_days);
  INSERT INTO public.admin_logs(admin_id, action, target_user_id, details)
    VALUES (v_admin, 'approve_payment', v_user, jsonb_build_object('submission',p_submission,'plan',p_plan,'days',p_days));
END $$;

CREATE OR REPLACE FUNCTION public.admin_reject_payment(p_submission uuid, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin uuid := auth.uid(); v_user uuid;
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.payment_submissions SET status='rejected', reviewed_at=now(), reviewer_note=p_note WHERE id = p_submission RETURNING user_id INTO v_user;
  INSERT INTO public.admin_logs(admin_id, action, target_user_id, details)
    VALUES (v_admin, 'reject_payment', v_user, jsonb_build_object('submission',p_submission,'note',p_note));
END $$;

CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin uuid := auth.uid(); v jsonb;
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'active_users_7d', (SELECT count(*) FROM public.profiles WHERE updated_at > now() - interval '7 days'),
    'online_users', public.online_count(),
    'premium_users', (SELECT count(*) FROM public.profiles WHERE is_premium = true AND (premium_until IS NULL OR premium_until > now())),
    'gold_users', (SELECT count(*) FROM public.profiles WHERE plan = 'gold' AND is_premium = true),
    'platinum_users', (SELECT count(*) FROM public.profiles WHERE plan = 'platinum' AND is_premium = true),
    'total_revenue', (SELECT COALESCE(sum(amount_inr),0) FROM public.payment_submissions WHERE status = 'approved'),
    'revenue_today', (SELECT COALESCE(sum(amount_inr),0) FROM public.payment_submissions WHERE status='approved' AND reviewed_at::date = (now() at time zone 'utc')::date),
    'revenue_month', (SELECT COALESCE(sum(amount_inr),0) FROM public.payment_submissions WHERE status='approved' AND reviewed_at > date_trunc('month', now())),
    'pending_payments', (SELECT count(*) FROM public.payment_submissions WHERE status = 'pending'),
    'recent_signups', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '24 hours'),
    'open_tickets', (SELECT count(*) FROM public.support_tickets WHERE status = 'open')
  ) INTO v;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_users(p_search text DEFAULT NULL, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS TABLE (user_id uuid, display_name text, username text, country text, region text, coins integer, plan text, is_premium boolean, premium_until timestamptz, banned_until timestamptz, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
    SELECT p.user_id, p.display_name, p.username, p.country, p.region, p.coins, p.plan, p.is_premium, p.premium_until, p.banned_until, p.created_at
    FROM public.profiles p
    WHERE p_search IS NULL OR p_search = ''
       OR p.display_name ILIKE '%'||p_search||'%'
       OR p.username ILIKE '%'||p_search||'%'
       OR p.user_id::text = p_search
    ORDER BY p.created_at DESC
    LIMIT GREATEST(p_limit,1) OFFSET GREATEST(p_offset,0);
END $$;

CREATE OR REPLACE FUNCTION public.admin_daily_signups(p_days integer DEFAULT 14)
RETURNS TABLE (day date, signups integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
    SELECT d::date AS day, COALESCE(count(p.user_id),0)::int AS signups
    FROM generate_series((now() - make_interval(days => p_days))::date, now()::date, '1 day') d
    LEFT JOIN public.profiles p ON p.created_at::date = d::date
    GROUP BY d ORDER BY d;
END $$;

CREATE OR REPLACE FUNCTION public.admin_daily_revenue(p_days integer DEFAULT 14)
RETURNS TABLE (day date, revenue integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
    SELECT d::date AS day, COALESCE(sum(ps.amount_inr),0)::int AS revenue
    FROM generate_series((now() - make_interval(days => p_days))::date, now()::date, '1 day') d
    LEFT JOIN public.payment_submissions ps ON ps.status='approved' AND ps.reviewed_at::date = d::date
    GROUP BY d ORDER BY d;
END $$;

CREATE OR REPLACE FUNCTION public.admin_payment_screenshot_url(p_submission uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_admin uuid := auth.uid(); v_path text;
BEGIN
  IF NOT public.has_role(v_admin, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT screenshot_path INTO v_path FROM public.payment_submissions WHERE id = p_submission;
  RETURN v_path;
END $$;

-- Storage policy: admins can read payment-proofs
CREATE POLICY "admins read payment proofs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(), 'admin'));

-- Bootstrap: promote the earliest signed-up user to admin (one-time, safe to re-run)
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'admin'::app_role FROM public.profiles ORDER BY created_at ASC LIMIT 1
ON CONFLICT DO NOTHING;
