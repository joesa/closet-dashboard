-- Generalize the widget domain so the platform serves any service business
-- (plumbing, towing, pressure washing, tree removal, landscaping…), not just
-- closets. Adds a per-contractor domain_config (labels + pricing model + unit
-- bounds), an industry tag, and migrates the two hardcoded closet add-on price
-- columns into the generic contractor_addons table.
--
-- Backward compatible: defaults reproduce the existing closet behaviour exactly,
-- so live embedded widgets keep working unchanged.

-- ── 1. domain_config on contractor_settings ────────────────────────────────
-- Shape:
--   {
--     "categoryLabel": "Room",          -- what a "job type" is called
--     "unitLabel": "Linear Feet",       -- the measured unit
--     "unitAbbrev": "ft",
--     "tierLabel": "Finish",            -- what a pricing tier is called
--     "pricingModel": "per_unit",       -- per_unit | flat_tiered | base_plus_distance
--     "unitMin": 5,
--     "unitMax": 250,
--     "baseFee": 0                      -- hookup/base fee for base_plus_distance
--   }
ALTER TABLE public.contractor_settings
  ADD COLUMN IF NOT EXISTS domain_config JSONB NOT NULL DEFAULT '{
    "categoryLabel": "Room",
    "unitLabel": "Linear Feet",
    "unitAbbrev": "ft",
    "tierLabel": "Finish",
    "pricingModel": "per_unit",
    "unitMin": 5,
    "unitMax": 250,
    "baseFee": 0
  }'::jsonb;

-- Industry / trade label used by AI provisioning + outreach copy.
ALTER TABLE public.contractor_settings
  ADD COLUMN IF NOT EXISTS industry TEXT NOT NULL DEFAULT 'Custom Closets';

-- The public widget reads domain_config via the anon /api/settings client.
GRANT SELECT (domain_config) ON public.contractor_settings TO anon;

-- ── 2. industry on prospect_intakes ────────────────────────────────────────
ALTER TABLE public.prospect_intakes
  ADD COLUMN IF NOT EXISTS industry TEXT;

-- ── 3. Migrate hardcoded closet add-on columns into contractor_addons ───────
-- price_drawer / price_shoe_rack are deprecated. Move any non-zero values into
-- the generic add-on catalog so the widget no longer depends on closet-specific
-- columns. Idempotent: only inserts when a matching add-on doesn't already exist.
INSERT INTO public.contractor_addons (contractor_id, room_type, name, price)
SELECT cs.id, 'Walk-In Closet', 'Drawer', cs.price_drawer
FROM public.contractor_settings cs
WHERE COALESCE(cs.price_drawer, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.contractor_addons a
    WHERE a.contractor_id = cs.id AND a.name = 'Drawer'
  );

INSERT INTO public.contractor_addons (contractor_id, room_type, name, price)
SELECT cs.id, 'Walk-In Closet', 'Shoe Rack', cs.price_shoe_rack
FROM public.contractor_settings cs
WHERE COALESCE(cs.price_shoe_rack, 0) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.contractor_addons a
    WHERE a.contractor_id = cs.id AND a.name = 'Shoe Rack'
  );

-- NOTE: price_drawer / price_shoe_rack columns are intentionally left in place
-- (DEPRECATED) so older widget builds that still read them keep working. Drop
-- them in a follow-up migration once all widgets are on contractor_addons.
COMMENT ON COLUMN public.contractor_settings.price_drawer IS
  'DEPRECATED: migrated to contractor_addons. Kept for legacy widget builds.';
COMMENT ON COLUMN public.contractor_settings.price_shoe_rack IS
  'DEPRECATED: migrated to contractor_addons. Kept for legacy widget builds.';
