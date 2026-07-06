-- Deterministic quote-vs-order system detection (EngagementModel in
-- closet-dashboard/src/lib/catalog/types.ts). Most trades get a quote
-- calculator (existing <closet-quote-widget>); direct-purchase menu/catalog
-- businesses (e.g. restaurants-bars) get an order flow instead. See
-- /home/joe/repos/lead_engine (plan doc: quote vs order system detection).

-- Static catalog industries encode this in-code (IndustryDef.engagementModel,
-- optional, defaults to 'quote' via getEngagementModel()). Custom (AI-
-- generated) industries need the same DB-level guarantee already used for
-- before_after_category: NOT NULL + CHECK so a dynamically-created industry
-- can never end up without an explicit engagement model.
ALTER TABLE custom_industries
  ADD COLUMN IF NOT EXISTS engagement_model TEXT NOT NULL DEFAULT 'quote'
    CHECK (engagement_model IN ('quote', 'order'));

-- Resolved once at provisioning time (getEngagementModel(resolveIndustrySlug(...)))
-- and stored on site_configs so the renderer knows which widget/section to
-- show without re-deriving it on every request.
ALTER TABLE site_configs
  ADD COLUMN IF NOT EXISTS engagement_model TEXT NOT NULL DEFAULT 'quote'
    CHECK (engagement_model IN ('quote', 'order'));

COMMENT ON COLUMN site_configs.engagement_model IS
  'quote = rooms/services -> estimate -> lead capture (default, <closet-quote-widget>). order = menu/catalog -> cart -> submit order (<closet-order-widget>, e.g. restaurants-bars).';
