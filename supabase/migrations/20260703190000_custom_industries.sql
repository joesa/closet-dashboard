-- Custom industries: contractors can type a trade that isn't in the static
-- catalog (src/lib/catalog/industries/*.ts). When that happens (see
-- /api/intake/[token]/resolve-custom-industry), the system uses Gemini to
-- generate a lightweight industry definition (services, keywords, a starting
-- theme/layout pool, and a REQUIRED before/after image subject category) and
-- persists it here so future contractors can select the SAME industry from
-- the dropdown instead of typing free text again, and so provisioning reuses
-- the same services/themes/before-after treatment consistently.
CREATE TABLE IF NOT EXISTS custom_industries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  -- Array of { label, keywords, widgetCategory, description } objects.
  services JSONB NOT NULL DEFAULT '[]',
  default_themes TEXT[] NOT NULL DEFAULT '{}',
  default_layouts TEXT[] NOT NULL DEFAULT '{}',
  -- Mirrors BeforeAfterCategory in closet-dashboard/src/lib/openai-images.ts.
  -- NOT NULL + CHECK constraint so a custom industry can never end up
  -- without a before/after image category (the exact bug class the
  -- Record<IndustrySlug, BeforeAfterCategory> exhaustiveness check prevents
  -- for the STATIC catalog; this is the equivalent guarantee for DYNAMIC
  -- custom industries, enforced by the DB instead of the TS compiler).
  before_after_category TEXT NOT NULL DEFAULT 'interior-space'
    CHECK (before_after_category IN ('vehicle', 'exterior', 'fixture', 'pet', 'interior-space')),
  source_intake_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_industries_slug ON custom_industries (slug);

-- Public read access — the intake form dropdown and provisioning both need
-- to look these up without an authenticated admin session.
ALTER TABLE custom_industries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on custom_industries" ON custom_industries;
CREATE POLICY "Allow public read access on custom_industries"
  ON custom_industries
  FOR SELECT
  USING (true);
