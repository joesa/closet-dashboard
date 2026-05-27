-- =============================================================================
-- ClosetQuote: Demo Account Seed
-- =============================================================================
-- Run this AFTER you have created the demo account through the normal signup
-- flow at https://closet-dashboard-orcin.vercel.app/signup
--
--   Email:    demo@closetquotes.com
--   Password: TryClosetQuote2026!   (or whatever you chose — share with prospects)
--
-- Once signed up, grab the contractor UUID from the dashboard (top-right of the
-- Contractor Settings panel) and paste it below. Then run the whole file in the
-- Supabase SQL Editor.
--
-- After running, also set this UUID as an environment variable in BOTH projects:
--   closet-dashboard (Vercel)  →  DEMO_CONTRACTOR_ID = <uuid>
--   closet-widget    (Vercel)  →  VITE_DEMO_CONTRACTOR_ID = <uuid>
--                                  VITE_ALLOWED_DEMO_DOMAINS = closet-dashboard-orcin.vercel.app,localhost,127.0.0.1
--
-- The dashboard uses DEMO_CONTRACTOR_ID to bypass Twilio SMS dispatch on demo
-- submissions; the widget uses VITE_DEMO_CONTRACTOR_ID + the allowed-domains
-- list to render a lock screen if the demo embed code is ever copied onto an
-- unauthorized site.
-- =============================================================================

-- Wrapped in a DO block so it runs in the Supabase SQL Editor (which speaks
-- raw Postgres, not psql — so `\set` meta-commands aren't supported). Set
-- the UUID once below and run the whole file.

do $demo$
declare
  demo_id uuid := 'ec376123-f499-4ad4-88c9-2b63ad6f90ab';
begin

  -- ---------------------------------------------------------------------------
  -- 1) Rich room-pricing matrix across all 14 system rooms
  -- ---------------------------------------------------------------------------
  update public.contractor_settings
  set
    company_name      = 'ClosetQuote Demo Co.',
    primary_color_hex = '#0f172a',
    price_drawer      = 95,
    price_shoe_rack   = 60,
    room_pricing = '{
      "Walk-In Closet":       {"basic": 45, "standard": 75,  "premium": 140},
      "Reach-In Closet":      {"basic": 35, "standard": 55,  "premium": 95},
      "Garage":               {"basic": 70, "standard": 110, "premium": 180},
      "Pantry & Wine":        {"basic": 30, "standard": 50,  "premium": 90},
      "Home Office":          {"basic": 60, "standard": 90,  "premium": 150},
      "Laundry Room":         {"basic": 40, "standard": 65,  "premium": 100},
      "Mudroom":              {"basic": 45, "standard": 70,  "premium": 115},
      "Entertainment Center": {"basic": 80, "standard": 120, "premium": 200},
      "Wall Beds":            {"basic": 90, "standard": 130, "premium": 210},
      "Craft Room":           {"basic": 35, "standard": 60,  "premium": 95},
      "Home Library":         {"basic": 75, "standard": 115, "premium": 185},
      "Kid Spaces":           {"basic": 30, "standard": 45,  "premium": 80},
      "Dressing Room":        {"basic": 65, "standard": 100, "premium": 160},
      "Home Storage":         {"basic": 40, "standard": 65,  "premium": 105}
    }'::jsonb
  where id = demo_id;

  if not found then
    raise exception 'No contractor_settings row found for id %. Did you sign up first?', demo_id;
  end if;

  -- ---------------------------------------------------------------------------
  -- 2) Custom finishes (material selections beyond the 3 defaults)
  -- ---------------------------------------------------------------------------
  delete from public.contractor_finishes where contractor_id = demo_id;

  insert into public.contractor_finishes
    (contractor_id, label, description, swatch_hex, tier, sort_order)
  values
    (demo_id, 'High-Gloss Acrylic', 'Mirror-finish lacquer, ultra-modern',    '#f8fafc', 'premium',  1),
    (demo_id, 'Walnut Veneer',      'Real-wood veneer, rich grain',           '#5c3a21', 'premium',  2),
    (demo_id, 'Brushed Oak',        'Warm matte oak with soft brushed grain', '#b08868', 'standard', 3),
    (demo_id, 'Charcoal Linen',     'Textured charcoal, low-sheen',           '#3f3f46', 'standard', 4),
    (demo_id, 'Soft White Matte',   'Designer matte white, no glare',         '#f3f4f6', 'basic',    5),
    (demo_id, 'Greige Woodgrain',   'Warm greige with light woodgrain',       '#a8a29e', 'basic',    6);

  -- ---------------------------------------------------------------------------
  -- 3) Add-ons (the upsell menu shown on Step 4 of the widget)
  --    Rich, room-specific catalog so prospects see industry-appropriate
  --    upsells (e.g. "Rolling Library Ladder" under Home Library).
  --    The canonical version of this catalog lives in the later
  --    migration 20260523044537_demo_addons_rich_catalog.sql — keep
  --    these two lists in sync if you edit either.
  -- ---------------------------------------------------------------------------
  delete from public.contractor_addons where contractor_id = demo_id;

  insert into public.contractor_addons (contractor_id, room_type, name, price) values
    (demo_id, 'Walk-In Closet',       'Velvet Jewelry Tray',              150),
    (demo_id, 'Walk-In Closet',       'Slanted Shoe Shelves',             250),
    (demo_id, 'Walk-In Closet',       'Center Island w/ Quartz',         1200),
    (demo_id, 'Walk-In Closet',       'Pull-out Hamper',                  120),
    (demo_id, 'Walk-In Closet',       'Valet Rod',                         45),
    (demo_id, 'Reach-In Closet',      'Double Hang Section',               85),
    (demo_id, 'Reach-In Closet',      'Tie & Belt Rack',                   55),
    (demo_id, 'Reach-In Closet',      'Wire Baskets',                      90),
    (demo_id, 'Garage',               'Heavy-Duty Slatwall (per section)', 300),
    (demo_id, 'Garage',               'Overhead Storage Rack',             450),
    (demo_id, 'Garage',               'Epoxy Floor Coating',              2500),
    (demo_id, 'Garage',               'Locked Steel Tool Cabinet',         350),
    (demo_id, 'Pantry & Wine',        'Pull-out Spice Rack',               180),
    (demo_id, 'Pantry & Wine',        'Wine Lattice (12 bottle)',          220),
    (demo_id, 'Pantry & Wine',        'Stemware Holder',                    85),
    (demo_id, 'Pantry & Wine',        'Woven Storage Baskets',             110),
    (demo_id, 'Home Office',          'Slide-out Keyboard Tray',            95),
    (demo_id, 'Home Office',          'Locking File Drawer',               160),
    (demo_id, 'Home Office',          'LED Puck Lighting',                 120),
    (demo_id, 'Laundry Room',         'Fold-down Ironing Board',           275),
    (demo_id, 'Laundry Room',         'Pull-out Drying Rack',              130),
    (demo_id, 'Laundry Room',         'Detergent Pull-out Tray',           110),
    (demo_id, 'Mudroom',              'Boot Bench w/ Storage',             450),
    (demo_id, 'Mudroom',              'Heavy-Duty Coat Hooks',              75),
    (demo_id, 'Mudroom',              'Built-in Umbrella Stand',            60),
    (demo_id, 'Entertainment Center', 'Glass Display Doors',               350),
    (demo_id, 'Entertainment Center', 'Cable Management System',            80),
    (demo_id, 'Entertainment Center', 'Floating Soundbar Shelf',           110),
    (demo_id, 'Wall Beds',            'Built-in Nightstands',              400),
    (demo_id, 'Wall Beds',            'LED Reading Lights',                150),
    (demo_id, 'Wall Beds',            'Upgraded Memory Foam Mattress',     600),
    (demo_id, 'Craft Room',           'Ribbon Dispenser Pull-out',          90),
    (demo_id, 'Craft Room',           'Wrapping Paper Station',            140),
    (demo_id, 'Craft Room',           'Custom Pegboard',                   110),
    (demo_id, 'Home Library',         'Rolling Library Ladder',            850),
    (demo_id, 'Home Library',         'Display Lighting',                  250),
    (demo_id, 'Home Library',         'Glass Enclosed Doors',              400),
    (demo_id, 'Kid Spaces',           'Slide-out Toy Bins',                120),
    (demo_id, 'Kid Spaces',           'Adjustable Study Desk',             250),
    (demo_id, 'Kid Spaces',           'Cushioned Window Seat',             300),
    (demo_id, 'Dressing Room',        'Lighted Vanity Mirror',             450),
    (demo_id, 'Dressing Room',        'Locked Safe Drawer',                350),
    (demo_id, 'Dressing Room',        'Upholstered Center Bench',          280),
    (demo_id, 'Home Storage',         'Heavy-Duty Storage Totes',           85),
    (demo_id, 'Home Storage',         'Reinforced Adjustable Shelving',    150);

  -- ---------------------------------------------------------------------------
  -- 4) Custom rooms (extra room types beyond the 14 system defaults)
  -- ---------------------------------------------------------------------------
  delete from public.contractor_rooms where contractor_id = demo_id;

  insert into public.contractor_rooms
    (contractor_id, name, price_basic, price_standard, price_premium)
  values
    (demo_id, 'Boat / RV Storage', 55, 85, 140),
    (demo_id, 'Hobby Workshop',    50, 80, 135);

end
$demo$;

-- -----------------------------------------------------------------------------
-- Done. Verify with (replace the uuid with your demo_id):
--   select company_name, room_pricing from contractor_settings
--     where id = 'ec376123-f499-4ad4-88c9-2b63ad6f90ab';
--   select count(*) from contractor_addons   where contractor_id = 'ec376123-f499-4ad4-88c9-2b63ad6f90ab';
--   select count(*) from contractor_finishes where contractor_id = 'ec376123-f499-4ad4-88c9-2b63ad6f90ab';
--   select count(*) from contractor_rooms    where contractor_id = 'ec376123-f499-4ad4-88c9-2b63ad6f90ab';
-- -----------------------------------------------------------------------------
