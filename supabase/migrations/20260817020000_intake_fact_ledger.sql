-- The intake fact ledger: one canonical, provenance-tagged record of what a
-- business told us about itself, readable by every generator.
--
-- Before this, the craft columns became prose only inside buildIntakeBrief,
-- which is reachable only from AI-Premium-gated routes — so a Standard
-- prospect's nine proprietary facts died in the table — and the Full redesign
-- that produces every shipped site read site_configs through a 900-character
-- hint string rather than the intake at all.
--
-- JSONB on the intake rather than a table: the ledger is per-intake, always
-- read whole, and never queried by field.

ALTER TABLE public.prospect_intakes
  ADD COLUMN IF NOT EXISTS fact_ledger jsonb,
  ADD COLUMN IF NOT EXISTS fact_ledger_version integer,
  ADD COLUMN IF NOT EXISTS fact_ledger_built_at timestamptz;

COMMENT ON COLUMN public.prospect_intakes.fact_ledger IS
  'Provenance-tagged facts (owner_typed | ai_suggested_accepted | ai_suggested_unedited | scraped). Built at submit by src/lib/intake/factLedger.ts. Rendered for models by renderFactsBrief(), which excludes ai_suggested_unedited.';

COMMENT ON COLUMN public.prospect_intakes.fact_ledger_version IS
  'FACT_LEDGER_VERSION the row was built with, so a rebuild can be targeted at stale rows.';
