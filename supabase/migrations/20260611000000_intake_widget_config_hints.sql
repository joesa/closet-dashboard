-- Add widget_config_hints JSONB to prospect_intakes.
-- Stores the answers from the ClosetQuote Pro intake wizard so the AI can
-- build a bespoke calculator config (rooms, add-ons, finishes) rather than
-- provisioning everyone with the same generic defaults.
ALTER TABLE prospect_intakes
  ADD COLUMN IF NOT EXISTS widget_config_hints JSONB;
