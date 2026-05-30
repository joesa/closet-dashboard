-- Scraper/outreach leads (Maps crawl). Distinct from public.leads (widget form submissions).
CREATE TABLE IF NOT EXISTS public.scraper_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id TEXT,
    business_name TEXT,
    email TEXT,
    phone TEXT,
    website TEXT,
    address TEXT,
    pipeline TEXT,
    outreach_rank TEXT,
    source TEXT NOT NULL DEFAULT 'scraper',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_scraper_leads_email ON public.scraper_leads(email);
CREATE INDEX IF NOT EXISTS idx_scraper_leads_phone ON public.scraper_leads(phone);
CREATE INDEX IF NOT EXISTS idx_scraper_leads_run_id ON public.scraper_leads(run_id);

ALTER TABLE public.scraper_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scraper_leads_service_role" ON public.scraper_leads;
CREATE POLICY "scraper_leads_service_role"
    ON public.scraper_leads FOR ALL
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "scraper_leads_admin_read" ON public.scraper_leads;
CREATE POLICY "scraper_leads_admin_read"
    ON public.scraper_leads FOR SELECT
    USING (public.is_admin());
