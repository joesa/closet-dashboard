-- Proprietary-fact intake fields.
--
-- The intake previously collected taste ("vibe", "tone") and category (industry,
-- services). Neither yields a sentence only this business could have written, so
-- generated copy fell back to adjectives. These columns collect the operational
-- specifics that make a page unfakeable: tolerances, rules, local conditions,
-- the artifact a customer actually sees, real timeframes, named materials.
--
-- All nullable. A site is still generatable with none of them; it just cannot
-- clear the specificity gate in src/lib/validation/siteValidator.ts.

ALTER TABLE public.prospect_intakes
  -- What the trade measures, and to what tolerance/spec. Drives concrete stats.
  ADD COLUMN IF NOT EXISTS craft_spec text,
  -- A rule the shop never breaks. Drives process and guarantee copy.
  ADD COLUMN IF NOT EXISTS shop_rule text,
  -- What goes wrong on jobs in this specific service area, and why.
  ADD COLUMN IF NOT EXISTS local_conditions text,
  -- Who does the work: headcount, roles, subcontracted or not.
  ADD COLUMN IF NOT EXISTS crew_shape text,
  -- The document/drawing/report a customer sees. Feeds the signature element.
  ADD COLUMN IF NOT EXISTS client_artifact text,
  -- One real recent job: what was wrong, what was done, what it cost/took.
  ADD COLUMN IF NOT EXISTS recent_job text,
  -- A spec or detail cheaper competitors get wrong.
  ADD COLUMN IF NOT EXISTS competitor_tell text,
  -- Real timeframes: enquiry to quote, quote to start, start to finish.
  ADD COLUMN IF NOT EXISTS timeline_facts text,
  -- Actual warranty/guarantee terms in the owner's words.
  ADD COLUMN IF NOT EXISTS guarantee_terms text,
  -- Named materials, brands, finishes, or equipment actually used.
  ADD COLUMN IF NOT EXISTS signature_materials text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.prospect_intakes.client_artifact IS
  'The tangible thing a customer receives or reviews (survey drawing, panel schedule, moisture map, planting plan). Site generation uses this as the signature design element rather than inventing decoration.';
