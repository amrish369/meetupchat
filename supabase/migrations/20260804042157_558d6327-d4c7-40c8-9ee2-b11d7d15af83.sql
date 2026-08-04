ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS is_adult boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS age_verified_at timestamptz;

CREATE TABLE IF NOT EXISTS public.moderation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  session_id text,
  kind text NOT NULL,
  severity integer NOT NULL DEFAULT 1,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.moderation_events TO authenticated;
GRANT ALL ON public.moderation_events TO service_role;
ALTER TABLE public.moderation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own moderation events" ON public.moderation_events;
CREATE POLICY "own moderation events" ON public.moderation_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admins read moderation events" ON public.moderation_events;
CREATE POLICY "admins read moderation events" ON public.moderation_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS moderation_events_user_kind_idx
  ON public.moderation_events(user_id, kind, created_at DESC);

CREATE OR REPLACE FUNCTION public.confirm_age(p_dob date)
RETURNS TABLE(is_adult boolean, age integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_age integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_dob IS NULL OR p_dob > current_date THEN RAISE EXCEPTION 'invalid date of birth'; END IF;
  v_age := date_part('year', age(current_date, p_dob))::int;
  IF v_age < 18 THEN
    UPDATE public.profiles
       SET date_of_birth = p_dob, is_adult = false, age_verified_at = now(), updated_at = now()
     WHERE user_id = v_uid;
    INSERT INTO public.moderation_events(user_id, kind, severity, details)
      VALUES (v_uid, 'age', 3, jsonb_build_object('age', v_age));
    RETURN QUERY SELECT false, v_age;
    RETURN;
  END IF;
  UPDATE public.profiles
     SET date_of_birth = p_dob, is_adult = true, age_verified_at = now(), updated_at = now()
   WHERE user_id = v_uid;
  RETURN QUERY SELECT true, v_age;
END $function$;

CREATE OR REPLACE FUNCTION public.record_moderation_violation(
  p_kind text,
  p_severity integer DEFAULT 1,
  p_details jsonb DEFAULT NULL,
  p_session_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer;
  v_action text := 'warned';
BEGIN
  IF p_kind NOT IN ('nudity','hate','recording','age','spam') THEN
    RAISE EXCEPTION 'invalid kind';
  END IF;

  INSERT INTO public.moderation_events(user_id, session_id, kind, severity, details)
  VALUES (v_uid, p_session_id, p_kind, GREATEST(COALESCE(p_severity,1),1), p_details);

  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('count', 0, 'action', v_action);
  END IF;

  SELECT count(*) INTO v_count
    FROM public.moderation_events
   WHERE user_id = v_uid AND kind = p_kind AND created_at > now() - interval '24 hours';

  IF v_count >= 3 THEN
    v_action := 'suspended';
    UPDATE public.profiles
       SET banned_until = GREATEST(COALESCE(banned_until, now()), now() + interval '24 hours'),
           trust_score = GREATEST(trust_score - 20, 0),
           updated_at = now()
     WHERE user_id = v_uid;
  ELSE
    UPDATE public.profiles
       SET trust_score = GREATEST(trust_score - 5, 0), updated_at = now()
     WHERE user_id = v_uid;
  END IF;

  RETURN jsonb_build_object('count', v_count, 'action', v_action);
END $function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_dob date;
  v_adult boolean := false;
BEGIN
  BEGIN
    v_dob := NULLIF(NEW.raw_user_meta_data->>'date_of_birth','')::date;
  EXCEPTION WHEN others THEN v_dob := NULL;
  END;
  IF v_dob IS NOT NULL THEN
    v_adult := date_part('year', age(current_date, v_dob))::int >= 18;
  END IF;

  INSERT INTO public.profiles (user_id, display_name, referral_code, date_of_birth, is_adult, age_verified_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
    v_dob,
    v_adult,
    CASE WHEN v_dob IS NOT NULL THEN now() ELSE NULL END
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $function$;