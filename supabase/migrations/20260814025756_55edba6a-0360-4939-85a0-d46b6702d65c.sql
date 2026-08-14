CREATE TABLE public.seo_promos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_slug TEXT,
  target_url TEXT NOT NULL,
  channel TEXT NOT NULL,
  headline TEXT NOT NULL,
  body TEXT NOT NULL,
  hashtags TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued',
  run_id UUID,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT seo_promos_status_check CHECK (status IN ('queued','posted','skipped')),
  CONSTRAINT seo_promos_channel_check CHECK (channel IN ('x','whatsapp','telegram','reddit','meta'))
);

GRANT ALL ON public.seo_promos TO service_role;
ALTER TABLE public.seo_promos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage promos" ON public.seo_promos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seo_promos TO authenticated;

CREATE INDEX seo_promos_created_idx ON public.seo_promos (created_at DESC);
CREATE INDEX seo_promos_status_idx ON public.seo_promos (status);

CREATE TABLE public.seo_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target TEXT NOT NULL,
  engine TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  http_status INTEGER,
  detail TEXT,
  retry_after TIMESTAMPTZ,
  run_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT seo_submissions_status_check CHECK (status IN ('pending','submitted','failed','skipped')),
  CONSTRAINT seo_submissions_engine_check CHECK (engine IN ('indexnow','google_search_console'))
);

GRANT ALL ON public.seo_submissions TO service_role;
ALTER TABLE public.seo_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read submissions" ON public.seo_submissions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.seo_submissions TO authenticated;

CREATE INDEX seo_submissions_created_idx ON public.seo_submissions (created_at DESC);
CREATE INDEX seo_submissions_status_idx ON public.seo_submissions (status);

CREATE TRIGGER seo_promos_updated_at BEFORE UPDATE ON public.seo_promos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER seo_submissions_updated_at BEFORE UPDATE ON public.seo_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();