-- Per-service UX fields for quote engines + package tier color swatches.
ALTER TABLE public.contractor_rooms
  ADD COLUMN IF NOT EXISTS icon text NULL,
  ADD COLUMN IF NOT EXISTS requires_package boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS requires_materials boolean NOT NULL DEFAULT false;

ALTER TABLE public.contractor_settings
  ADD COLUMN IF NOT EXISTS tier_colors jsonb NULL;

COMMENT ON COLUMN public.contractor_rooms.icon IS 'Lucide icon key for widget service tiles';
COMMENT ON COLUMN public.contractor_rooms.requires_package IS 'When false, widget skips package/finish step and uses standard tier';
COMMENT ON COLUMN public.contractor_rooms.requires_materials IS 'When true, package step shows material/finish swatches; when false, package-only cards';
COMMENT ON COLUMN public.contractor_settings.tier_colors IS 'Hex swatches for basic/standard/premium package cards: {basic,standard,premium}';

GRANT SELECT (icon, requires_package, requires_materials) ON public.contractor_rooms TO anon;
GRANT SELECT (tier_colors) ON public.contractor_settings TO anon;

-- Cache for Firecrawl metro market price bounds (Phase 5).
CREATE TABLE IF NOT EXISTS public.service_market_bounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metro text NOT NULL,
  service_key text NOT NULL,
  industry_slug text NULL,
  low numeric NOT NULL,
  high numeric NOT NULL,
  samples integer NOT NULL DEFAULT 0,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (metro, service_key)
);

CREATE INDEX IF NOT EXISTS service_market_bounds_fetched_at_idx
  ON public.service_market_bounds (fetched_at DESC);

ALTER TABLE public.service_market_bounds ENABLE ROW LEVEL SECURITY;
