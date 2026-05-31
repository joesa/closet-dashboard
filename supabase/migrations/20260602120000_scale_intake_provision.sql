-- Scale intake → provision: public intake metadata, rate limits, async jobs, AI counters.

ALTER TABLE public.prospect_intakes
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'admin',
  ADD COLUMN IF NOT EXISTS requested_product TEXT NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_email TEXT;

ALTER TABLE public.prospect_intakes
  DROP CONSTRAINT IF EXISTS prospect_intakes_source_check;
ALTER TABLE public.prospect_intakes
  ADD CONSTRAINT prospect_intakes_source_check
  CHECK (source IN ('admin', 'public', 'scraper'));

ALTER TABLE public.prospect_intakes
  DROP CONSTRAINT IF EXISTS prospect_intakes_requested_product_check;
ALTER TABLE public.prospect_intakes
  ADD CONSTRAINT prospect_intakes_requested_product_check
  CHECK (requested_product IN ('full', 'widget'));

CREATE INDEX IF NOT EXISTS idx_prospect_intakes_verification_email
  ON public.prospect_intakes (verification_email, created_at DESC);

CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  bucket_key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start)
);

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rate_limit_buckets_service_role" ON public.rate_limit_buckets;
CREATE POLICY "rate_limit_buckets_service_role"
  ON public.rate_limit_buckets FOR ALL
  USING (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS public.provision_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_id UUID NOT NULL UNIQUE REFERENCES public.prospect_intakes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  mode TEXT NOT NULL DEFAULT 'full',
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

ALTER TABLE public.provision_jobs
  DROP CONSTRAINT IF EXISTS provision_jobs_status_check;
ALTER TABLE public.provision_jobs
  ADD CONSTRAINT provision_jobs_status_check
  CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'needs_review'));

ALTER TABLE public.provision_jobs
  DROP CONSTRAINT IF EXISTS provision_jobs_mode_check;
ALTER TABLE public.provision_jobs
  ADD CONSTRAINT provision_jobs_mode_check
  CHECK (mode IN ('full', 'widget'));

CREATE INDEX IF NOT EXISTS idx_provision_jobs_status_created
  ON public.provision_jobs (status, created_at);

ALTER TABLE public.provision_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "provision_jobs_service_role" ON public.provision_jobs;
CREATE POLICY "provision_jobs_service_role"
  ON public.provision_jobs FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "provision_jobs_admin_read" ON public.provision_jobs;
CREATE POLICY "provision_jobs_admin_read"
  ON public.provision_jobs FOR SELECT
  USING (public.is_admin());

CREATE TABLE IF NOT EXISTS public.ai_usage_daily (
  usage_date DATE NOT NULL PRIMARY KEY DEFAULT (timezone('utc'::text, now()))::date,
  generate_site_count INT NOT NULL DEFAULT 0,
  generate_images_count INT NOT NULL DEFAULT 0
);

ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_usage_daily_service_role" ON public.ai_usage_daily;
CREATE POLICY "ai_usage_daily_service_role"
  ON public.ai_usage_daily FOR ALL
  USING (auth.role() = 'service_role');
