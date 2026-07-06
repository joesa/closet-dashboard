-- Adds 'not-applicable' to the set of valid before/after subject categories
-- (see EngagementModel-adjacent BeforeAfterCategory in closet-dashboard's
-- src/lib/openai-images.ts) — a before/after transformation slider doesn't
-- make sense for direct-purchase/order businesses (restaurants), pure
-- professional/knowledge services (legal, financial, consulting, IT), or
-- ticketed/booking businesses (hotels, museums, theaters). Postgres CHECK
-- constraints can't be altered in place; drop and recreate.
ALTER TABLE custom_industries
  DROP CONSTRAINT IF EXISTS custom_industries_before_after_category_check;

ALTER TABLE custom_industries
  ADD CONSTRAINT custom_industries_before_after_category_check
  CHECK (before_after_category IN ('vehicle', 'exterior', 'fixture', 'pet', 'interior-space', 'not-applicable'));

-- Also flip the column default: with zero signal about a custom industry,
-- skipping before/after entirely is safer than guessing a generic room scene.
ALTER TABLE custom_industries
  ALTER COLUMN before_after_category SET DEFAULT 'not-applicable';
