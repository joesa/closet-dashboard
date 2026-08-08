-- Preserve structured Google Maps business details and distinguish an owned
-- website from a social profile discovered during no-website enrichment.
ALTER TABLE public.scraper_leads
  ADD COLUMN IF NOT EXISTS business_category text,
  ADD COLUMN IF NOT EXISTS additional_categories text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS services_provided text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS services_source text,
  ADD COLUMN IF NOT EXISTS business_description text,
  ADD COLUMN IF NOT EXISTS social_profile_url text,
  ADD COLUMN IF NOT EXISTS has_own_website boolean NOT NULL DEFAULT false;

ALTER TABLE public.scraper_run_results
  ADD COLUMN IF NOT EXISTS filters jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_scraper_leads_has_own_website
  ON public.scraper_leads (has_own_website);

CREATE INDEX IF NOT EXISTS idx_scraper_leads_business_category
  ON public.scraper_leads (business_category);

-- Repair the historical ambiguity where Facebook/Instagram URLs were stored as
-- if they were owned websites, then backfill the explicit ownership flag.
UPDATE public.scraper_leads
   SET social_profile_url = website,
       website = NULL
 WHERE website IS NOT NULL
   AND lower(website) ~ '^https?://([^/]+\.)?(facebook|instagram)\.com(/|$)';

UPDATE public.scraper_leads
   SET has_own_website = NULLIF(trim(website), '') IS NOT NULL;
