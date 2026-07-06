-- Agentic site-validation gate: before a provisioned site is offered to the
-- admin for preview/approval, an automated battery of checks (theme/layout
-- consistency, nav presence, broken links/images, duplicate "bespoke" design)
-- must pass. Tracked independently of `tenants.site_status` (the payment/
-- launch state machine) so the two concerns never conflict.
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS validation_status text
    CHECK (validation_status IN ('pending', 'passed', 'failed')),
  ADD COLUMN IF NOT EXISTS validation_report jsonb,
  ADD COLUMN IF NOT EXISTS validated_at timestamptz;

COMMENT ON COLUMN tenants.validation_status IS
  'Automated site-QA gate result: null = never run (legacy/widget-only), pending = queued/in progress, passed = safe to preview & approve, failed = needs fixes.';
COMMENT ON COLUMN tenants.validation_report IS
  'Array of {code, severity, message, fixable} issue objects from the last validation run.';
