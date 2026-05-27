-- =============================================================================
-- Replace the demo contractor's add-ons with a rich, room-specific catalog.
-- =============================================================================
-- Replaces the prior 18 generic (room_type='all') add-ons with 45 add-ons
-- scoped to each of the 14 system rooms. The goal is that when a prospect
-- testing the widget clicks "Garage" they immediately see "Overhead
-- Storage Rack" and "Epoxy Floor Coating" — convincing them this is a
-- purpose-built upsell engine for their industry, not a generic
-- calculator.
--
-- Table shape (already established):
--   contractor_addons(id uuid, contractor_id uuid, room_type text,
--                     name text, price numeric, created_at timestamptz)
--
-- Idempotent: deletes the demo contractor's existing add-ons before
-- inserting the new catalog, so re-running the migration is safe.
-- =============================================================================

do $demo_addons$
declare
  demo_id constant uuid := 'ec376123-f499-4ad4-88c9-2b63ad6f90ab';
begin
  -- Wipe any existing add-ons for the demo contractor (generic or otherwise).
  delete from public.contractor_addons where contractor_id = demo_id;

  insert into public.contractor_addons (contractor_id, room_type, name, price) values
    -- Walk-In Closet
    (demo_id, 'Walk-In Closet', 'Velvet Jewelry Tray',         150),
    (demo_id, 'Walk-In Closet', 'Slanted Shoe Shelves',        250),
    (demo_id, 'Walk-In Closet', 'Center Island w/ Quartz',    1200),
    (demo_id, 'Walk-In Closet', 'Pull-out Hamper',             120),
    (demo_id, 'Walk-In Closet', 'Valet Rod',                    45),

    -- Reach-In Closet
    (demo_id, 'Reach-In Closet', 'Double Hang Section',         85),
    (demo_id, 'Reach-In Closet', 'Tie & Belt Rack',             55),
    (demo_id, 'Reach-In Closet', 'Wire Baskets',                90),

    -- Garage
    (demo_id, 'Garage', 'Heavy-Duty Slatwall (per section)',   300),
    (demo_id, 'Garage', 'Overhead Storage Rack',               450),
    (demo_id, 'Garage', 'Epoxy Floor Coating',                2500),
    (demo_id, 'Garage', 'Locked Steel Tool Cabinet',           350),

    -- Pantry & Wine
    (demo_id, 'Pantry & Wine', 'Pull-out Spice Rack',          180),
    (demo_id, 'Pantry & Wine', 'Wine Lattice (12 bottle)',     220),
    (demo_id, 'Pantry & Wine', 'Stemware Holder',               85),
    (demo_id, 'Pantry & Wine', 'Woven Storage Baskets',        110),

    -- Home Office
    (demo_id, 'Home Office', 'Slide-out Keyboard Tray',         95),
    (demo_id, 'Home Office', 'Locking File Drawer',            160),
    (demo_id, 'Home Office', 'LED Puck Lighting',              120),

    -- Laundry Room
    (demo_id, 'Laundry Room', 'Fold-down Ironing Board',       275),
    (demo_id, 'Laundry Room', 'Pull-out Drying Rack',          130),
    (demo_id, 'Laundry Room', 'Detergent Pull-out Tray',       110),

    -- Mudroom
    (demo_id, 'Mudroom', 'Boot Bench w/ Storage',              450),
    (demo_id, 'Mudroom', 'Heavy-Duty Coat Hooks',               75),
    (demo_id, 'Mudroom', 'Built-in Umbrella Stand',             60),

    -- Entertainment Center
    (demo_id, 'Entertainment Center', 'Glass Display Doors',   350),
    (demo_id, 'Entertainment Center', 'Cable Management System', 80),
    (demo_id, 'Entertainment Center', 'Floating Soundbar Shelf', 110),

    -- Wall Beds
    (demo_id, 'Wall Beds', 'Built-in Nightstands',             400),
    (demo_id, 'Wall Beds', 'LED Reading Lights',               150),
    (demo_id, 'Wall Beds', 'Upgraded Memory Foam Mattress',    600),

    -- Craft Room
    (demo_id, 'Craft Room', 'Ribbon Dispenser Pull-out',        90),
    (demo_id, 'Craft Room', 'Wrapping Paper Station',          140),
    (demo_id, 'Craft Room', 'Custom Pegboard',                 110),

    -- Home Library
    (demo_id, 'Home Library', 'Rolling Library Ladder',        850),
    (demo_id, 'Home Library', 'Display Lighting',              250),
    (demo_id, 'Home Library', 'Glass Enclosed Doors',          400),

    -- Kid Spaces
    (demo_id, 'Kid Spaces', 'Slide-out Toy Bins',              120),
    (demo_id, 'Kid Spaces', 'Adjustable Study Desk',           250),
    (demo_id, 'Kid Spaces', 'Cushioned Window Seat',           300),

    -- Dressing Room
    (demo_id, 'Dressing Room', 'Lighted Vanity Mirror',        450),
    (demo_id, 'Dressing Room', 'Locked Safe Drawer',           350),
    (demo_id, 'Dressing Room', 'Upholstered Center Bench',     280),

    -- Home Storage
    (demo_id, 'Home Storage', 'Heavy-Duty Storage Totes',       85),
    (demo_id, 'Home Storage', 'Reinforced Adjustable Shelving', 150);
end
$demo_addons$;
