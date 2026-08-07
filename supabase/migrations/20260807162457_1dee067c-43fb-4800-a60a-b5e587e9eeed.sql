-- SEO Growth Engine tables
CREATE TABLE public.seo_keywords (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  keyword text NOT NULL,
  normalized text NOT NULL,
  source text NOT NULL,
  topic text,
  country text,
  state text,
  city text,
  category text,
  intent text,
  volume_estimate integer NOT NULL DEFAULT 0,
  competition numeric NOT NULL DEFAULT 0,
  trend_score numeric NOT NULL DEFAULT 0,
  is_relevant boolean NOT NULL DEFAULT true,
  used_for_page text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seo_keywords_normalized_key UNIQUE (normalized)
);

CREATE TABLE public.seo_pages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL,
  kind text NOT NULL DEFAULT 'topic',
  status text NOT NULL DEFAULT 'draft',
  title text NOT NULL,
  description text NOT NULL,
  h1 text NOT NULL,
  intro text NOT NULL DEFAULT '',
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  faqs jsonb NOT NULL DEFAULT '[]'::jsonb,
  keywords text[] NOT NULL DEFAULT '{}',
  primary_keyword text,
  category text,
  city text,
  country text,
  intent text,
  cluster text,
  room_slug text,
  related_slugs text[] NOT NULL DEFAULT '{}',
  word_count integer NOT NULL DEFAULT 0,
  content_hash text NOT NULL DEFAULT '',
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  redirect_to text,
  published_at timestamptz,
  refreshed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seo_pages_slug_key UNIQUE (slug)
);

CREATE INDEX seo_pages_status_idx ON public.seo_pages (status, published_at DESC);
CREATE INDEX seo_pages_cluster_idx ON public.seo_pages (cluster);

CREATE TABLE public.seo_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  keywords_found integer NOT NULL DEFAULT 0,
  keywords_kept integer NOT NULL DEFAULT 0,
  pages_created integer NOT NULL DEFAULT 0,
  pages_updated integer NOT NULL DEFAULT 0,
  pages_archived integer NOT NULL DEFAULT 0,
  rejected integer NOT NULL DEFAULT 0,
  traffic_potential integer NOT NULL DEFAULT 0,
  internal_links integer NOT NULL DEFAULT 0,
  issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  log jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text NOT NULL DEFAULT 'cron'
);

CREATE INDEX seo_runs_started_idx ON public.seo_runs (started_at DESC);

GRANT SELECT ON public.seo_pages TO anon;
GRANT SELECT ON public.seo_pages TO authenticated;
GRANT ALL ON public.seo_pages TO service_role;
GRANT SELECT ON public.seo_keywords TO authenticated;
GRANT ALL ON public.seo_keywords TO service_role;
GRANT SELECT ON public.seo_runs TO authenticated;
GRANT ALL ON public.seo_runs TO service_role;

ALTER TABLE public.seo_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published SEO pages are public" ON public.seo_pages
  FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY "Admins read all SEO pages" ON public.seo_pages
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read SEO keywords" ON public.seo_keywords
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins read SEO runs" ON public.seo_runs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER seo_pages_updated_at BEFORE UPDATE ON public.seo_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();