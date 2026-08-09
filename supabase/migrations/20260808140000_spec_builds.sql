-- =============================================================================
-- spec_builds — unattended "we already built your site" outreach pipeline.
-- =============================================================================
-- A spec build takes a cold lead with no website, builds a complete AI-Premium
-- site with no human input, holds it for admin review, then SMSes the owner a
-- link with a time-limited discount. No response by the deadline and the site
-- is deleted.
--
-- Why a dedicated table rather than columns on prospect_intakes:
--   * The row must exist BEFORE an intake does — a manually typed lead can fail
--     research and never produce one.
--   * prospect_intakes.status (draft|submitted|built|archived) is load-bearing
--     in assertDraftIntake, getIntakePaymentSummary and the public intake page.
--     A spec build passes through 'built' early and then has eight more states.
--   * provision_jobs.intake_id is UNIQUE, so it cannot carry rebuild attempts.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'spec_build_status') THEN
    CREATE TYPE spec_build_status AS ENUM (
      'queued',            -- accepted into the queue, nothing spent yet
      'researching',       -- gathering verifiable public facts
      'drafting',          -- intake row filled, generating the site config
      'imaging',           -- generating + auto-selecting hero/product images
      'provisioning',      -- handed off to provision_tenant
      'building',          -- handed off to full_redesign
      'ready_for_review',  -- built and validated, waiting on an admin
      'needs_attention',   -- failed somewhere; never auto-retries
      'rejected',          -- admin said no
      'approved',          -- admin said yes; offer token minted
      'offer_sent',
      'offer_reminded',
      'accepted',          -- owner wants it — converts to a real paid intake
      'declined',          -- owner said no, or replied STOP
      'expired',           -- deadline passed with no response
      'purged'             -- tenant, domain, auth user and site torn down
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.spec_builds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status spec_build_status NOT NULL DEFAULT 'queued',

    lead_source TEXT NOT NULL CHECK (lead_source IN ('scraper', 'manual')),
    scraper_lead_id UUID REFERENCES public.scraper_leads(id) ON DELETE SET NULL,
    scraper_run_id TEXT,
    -- Frozen copy of the lead as it looked when queued. The scraper re-inserts
    -- leads on every run without dedupe, so the source row can drift.
    lead_input JSONB NOT NULL DEFAULT '{}'::jsonb,

    business_name TEXT NOT NULL,
    phone_e164 TEXT NOT NULL,
    city TEXT,

    intake_id UUID UNIQUE REFERENCES public.prospect_intakes(id) ON DELETE SET NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    -- Unique per build on purpose: provisionTenant tears down any existing
    -- tenant that collides on owner_email, so a shared placeholder would have
    -- each build silently delete the previous one.
    placeholder_owner_email TEXT UNIQUE,

    -- { facts: SpecFact[], pages: {...} } — every claim with its evidence and
    -- source URL. This is the non-fabrication audit trail.
    research JSONB NOT NULL DEFAULT '{}'::jsonb,
    research_at TIMESTAMPTZ,

    offer_token TEXT UNIQUE,
    offer_total_cents INTEGER,
    offer_discount_bps INTEGER NOT NULL DEFAULT 5000,
    offer_deadline_at TIMESTAMPTZ,
    offer_sent_at TIMESTAMPTZ,
    offer_reminded_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    purge_after TIMESTAMPTZ,

    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    status_reason TEXT,
    approved_by UUID,
    approved_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- THE dedupe guard. scraper_leads has no dedupe by design, so without this a
-- repeat crawl of the same city would build the same business a second time.
-- Partial so a rejected/expired lead can be revisited later.
CREATE UNIQUE INDEX IF NOT EXISTS idx_spec_builds_live_phone
    ON public.spec_builds (phone_e164)
    WHERE status NOT IN ('rejected', 'declined', 'expired', 'purged');

CREATE INDEX IF NOT EXISTS idx_spec_builds_status
    ON public.spec_builds (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_spec_builds_purge
    ON public.spec_builds (purge_after)
    WHERE purge_after IS NOT NULL AND status <> 'purged';

CREATE INDEX IF NOT EXISTS idx_spec_builds_deadline
    ON public.spec_builds (offer_deadline_at)
    WHERE status IN ('offer_sent', 'offer_reminded');

CREATE INDEX IF NOT EXISTS idx_spec_builds_tenant ON public.spec_builds (tenant_id);

ALTER TABLE public.spec_builds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spec_builds_service_role" ON public.spec_builds;
CREATE POLICY "spec_builds_service_role"
    ON public.spec_builds FOR ALL
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "spec_builds_admin_read" ON public.spec_builds;
CREATE POLICY "spec_builds_admin_read"
    ON public.spec_builds FOR SELECT
    USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- prospect_intakes: a new provenance value and a waived deposit state.
-- -----------------------------------------------------------------------------
-- 'spec' is what every guard keys off — it is how autoApproveTenantSite knows
-- not to reveal the site and email a pay link to someone who never asked.
ALTER TABLE public.prospect_intakes
  DROP CONSTRAINT IF EXISTS prospect_intakes_source_check;
ALTER TABLE public.prospect_intakes
  ADD CONSTRAINT prospect_intakes_source_check
  CHECK (source IN ('admin', 'public', 'scraper', 'spec'));

-- 'waived' rather than lying with 'paid' + deposit_paid_cents = 0, which would
-- corrupt revenue reporting and make hasPaidPremiumDeposit() tell the truth
-- about money that never moved.
ALTER TABLE public.prospect_intakes
  DROP CONSTRAINT IF EXISTS prospect_intakes_deposit_status_check;
ALTER TABLE public.prospect_intakes
  ADD CONSTRAINT prospect_intakes_deposit_status_check
  CHECK (deposit_status IN ('not_required', 'pending', 'paid', 'failed', 'refunded', 'waived'));
