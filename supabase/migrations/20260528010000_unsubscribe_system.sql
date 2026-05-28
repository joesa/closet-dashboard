-- Create global suppressions table
CREATE TABLE IF NOT EXISTS public.global_suppressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_value TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('email', 'phone', 'domain')),
    source TEXT NOT NULL CHECK (source IN ('instantly', 'twilio', 'manual', 'system')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(contact_value, type)
);

CREATE INDEX IF NOT EXISTS idx_global_suppressions_contact_value ON public.global_suppressions(contact_value);
CREATE INDEX IF NOT EXISTS idx_global_suppressions_type ON public.global_suppressions(type);

-- Create leads table for correlation
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id TEXT,
    business_name TEXT,
    email TEXT,
    phone TEXT,
    website TEXT,
    address TEXT,
    pipeline TEXT,
    outreach_rank TEXT,
    source TEXT DEFAULT 'scraper',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads(phone);

-- Set up RLS (Restrict access to service role only by default)
ALTER TABLE public.global_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service Role Full Access Suppressions" ON public.global_suppressions
    FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Service Role Full Access Leads" ON public.leads
    FOR ALL
    USING (auth.role() = 'service_role');
