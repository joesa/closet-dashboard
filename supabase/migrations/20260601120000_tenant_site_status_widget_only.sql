-- Add a 'widget_only' status for tenants that only embed the Quote Calculator
-- on their existing website (Pipeline A) and have no hosted site/domain.
-- IF NOT EXISTS keeps this idempotent across the shared-DB migrate workflow.
ALTER TYPE tenant_site_status ADD VALUE IF NOT EXISTS 'widget_only';
