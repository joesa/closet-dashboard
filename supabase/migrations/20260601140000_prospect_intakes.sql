-- Prospect intake: the structured build/setup info a prospect fills in via a
-- shareable public link, so the admin has everything needed to build + launch
-- their site (contact/NAP for SEO schema, lead-routing destinations, brand
-- assets, desired domain, pricing notes, and the creative brief fields).
--
-- The public intake form writes through a service-role API route, so RLS stays
-- locked to service_role (write) + admins (read). No public policy needed.
CREATE TABLE IF NOT EXISTS public.prospect_intakes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Opaque token used in the shareable /intake/<token> link.
    token TEXT NOT NULL UNIQUE,
    -- draft (link created, not yet submitted) | submitted | built | archived
    status TEXT NOT NULL DEFAULT 'draft',
    -- Optional provenance: the scraper lead this intake was generated for.
    scraper_lead_id UUID,

    -- Identity & contact (powers seo_config + footer)
    business_name TEXT,
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    street_address TEXT,
    address_locality TEXT,
    address_region TEXT,
    postal_code TEXT,
    service_area TEXT,

    -- Lead routing (powers contractor_settings.contact_email/contact_phone)
    notification_email TEXT,
    notification_phone TEXT,

    -- Offering + pricing
    services TEXT[] NOT NULL DEFAULT '{}',
    pricing_notes TEXT,

    -- Brand & visual
    primary_color_hex TEXT,
    logo_url TEXT,
    vibe TEXT,
    tone TEXT,
    customers TEXT,
    experience TEXT,
    differentiators TEXT[] NOT NULL DEFAULT '{}',
    primary_cta TEXT,

    -- Site & domain
    desired_domain TEXT,

    notes TEXT,
    -- Catch-all for any extra fields captured by the form over time.
    raw JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    submitted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_prospect_intakes_status ON public.prospect_intakes(status);
CREATE INDEX IF NOT EXISTS idx_prospect_intakes_token ON public.prospect_intakes(token);

ALTER TABLE public.prospect_intakes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prospect_intakes_service_role" ON public.prospect_intakes;
CREATE POLICY "prospect_intakes_service_role"
    ON public.prospect_intakes FOR ALL
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "prospect_intakes_admin_read" ON public.prospect_intakes;
CREATE POLICY "prospect_intakes_admin_read"
    ON public.prospect_intakes FOR SELECT
    USING (public.is_admin());
