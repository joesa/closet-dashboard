-- =============================================================================
-- Aesthetic demo differentiation (Lumina / Ironclad / Hearth)
--
-- Make the three outreach demos feel hand-built: distinct IA (layout_style +
-- design_variant), craft/outcome heroes, real before/after pairs, brand-specific
-- social proof, no fake phones, and per-tenant widget domain language (no shared
-- closet "Linear Feet" leak onto garage/mudroom demos).
--
-- Identity rule (from 20260530120000_reconcile_tenant_widget_id):
--   tenant.id == widget_id == contractor_settings.id
-- =============================================================================

do $demo$
declare
  lumina_tid   uuid;
  ironclad_tid uuid;
  hearth_tid   uuid;

  closet_disabled text[] := array[
    'Garage', 'Pantry & Wine', 'Home Office', 'Laundry Room', 'Mudroom',
    'Entertainment Center', 'Wall Beds', 'Craft Room', 'Home Library',
    'Kid Spaces', 'Home Storage'
  ];
  garage_disabled text[] := array[
    'Walk-In Closet', 'Reach-In Closet', 'Pantry & Wine', 'Home Office',
    'Laundry Room', 'Mudroom', 'Entertainment Center', 'Wall Beds',
    'Craft Room', 'Home Library', 'Kid Spaces', 'Dressing Room', 'Home Storage'
  ];
  hearth_disabled text[] := array[
    'Walk-In Closet', 'Reach-In Closet', 'Garage', 'Home Office',
    'Entertainment Center', 'Wall Beds', 'Craft Room', 'Home Library',
    'Kid Spaces', 'Dressing Room', 'Home Storage'
  ];
begin
  select t.id into lumina_tid
  from public.domains d
  join public.tenants t on t.id = d.tenant_id
  where lower(d.hostname) in ('lumina.ditchtheform.com', 'lumina.closetquotes.com', 'lumina.localhost')
  order by case when d.hostname like '%.ditchtheform.com' then 0 else 1 end
  limit 1;

  select t.id into ironclad_tid
  from public.domains d
  join public.tenants t on t.id = d.tenant_id
  where lower(d.hostname) in ('ironclad.ditchtheform.com', 'ironclad.closetquotes.com', 'ironclad.localhost')
  order by case when d.hostname like '%.ditchtheform.com' then 0 else 1 end
  limit 1;

  select t.id into hearth_tid
  from public.domains d
  join public.tenants t on t.id = d.tenant_id
  where lower(d.hostname) in ('hearth.ditchtheform.com', 'hearth.closetquotes.com', 'hearth.localhost')
  order by case when d.hostname like '%.ditchtheform.com' then 0 else 1 end
  limit 1;

  if lumina_tid is null or ironclad_tid is null or hearth_tid is null then
    raise exception
      'Aesthetic demo tenants not found (lumina=%, ironclad=%, hearth=%)',
      lumina_tid, ironclad_tid, hearth_tid;
  end if;

  -- Guarantee contractor_settings rows keyed by tenant id, then own the widget.
  insert into public.contractor_settings (id, company_name)
  values
    (lumina_tid, 'Lumina Custom Closets'),
    (ironclad_tid, 'Ironclad Storage Co.'),
    (hearth_tid, 'Hearth & Home Spaces')
  on conflict (id) do nothing;

  update public.tenants
  set widget_id = id
  where id in (lumina_tid, ironclad_tid, hearth_tid);

  -- ── Lumina widget (closet language) ──────────────────────────────────────
  update public.contractor_settings
  set
    company_name = 'Lumina Custom Closets',
    industry = 'Custom Closets',
    primary_color_hex = '#1c1917',
    price_drawer = 95,
    price_shoe_rack = 60,
    domain_config = '{
      "categoryLabel": "Space",
      "unitLabel": "Linear Feet",
      "unitAbbrev": "ft",
      "tierLabel": "Finish",
      "pricingModel": "per_unit",
      "unitMin": 5,
      "unitMax": 80,
      "baseFee": 0
    }'::jsonb,
    tier_names = '{"basic":"Standard","standard":"Gallery","premium":"Signature"}'::jsonb,
    room_pricing = '{
      "Walk-In Closet":  {"basic": 45, "standard": 75,  "premium": 140},
      "Reach-In Closet": {"basic": 35, "standard": 55,  "premium": 95},
      "Dressing Room":  {"basic": 65, "standard": 100, "premium": 160},
      "Garage": {"basic": 70, "standard": 110, "premium": 180},
      "Pantry & Wine": {"basic": 30, "standard": 50, "premium": 90},
      "Home Office": {"basic": 60, "standard": 90, "premium": 150},
      "Laundry Room": {"basic": 40, "standard": 65, "premium": 100},
      "Mudroom": {"basic": 45, "standard": 70, "premium": 115},
      "Entertainment Center": {"basic": 80, "standard": 120, "premium": 200},
      "Wall Beds": {"basic": 90, "standard": 130, "premium": 210},
      "Craft Room": {"basic": 35, "standard": 60, "premium": 95},
      "Home Library": {"basic": 75, "standard": 115, "premium": 185},
      "Kid Spaces": {"basic": 30, "standard": 45, "premium": 80},
      "Home Storage": {"basic": 40, "standard": 65, "premium": 105}
    }'::jsonb,
    disabled_default_rooms = closet_disabled,
    updated_at = now()
  where id = lumina_tid;

  -- ── Ironclad widget (garage / wall-length language) ──────────────────────
  update public.contractor_settings
  set
    company_name = 'Ironclad Storage Co.',
    industry = 'Garage Storage',
    primary_color_hex = '#0a0a0a',
    price_drawer = 0,
    price_shoe_rack = 0,
    domain_config = '{
      "categoryLabel": "Zone",
      "unitLabel": "Wall Length",
      "unitAbbrev": "ft",
      "tierLabel": "Build",
      "pricingModel": "per_unit",
      "unitMin": 4,
      "unitMax": 60,
      "baseFee": 0
    }'::jsonb,
    tier_names = '{"basic":"Essential","standard":"Pro Shop","premium":"Showroom"}'::jsonb,
    room_pricing = '{
      "Garage": {"basic": 70, "standard": 110, "premium": 180},
      "Walk-In Closet": {"basic": 45, "standard": 75, "premium": 140},
      "Reach-In Closet": {"basic": 35, "standard": 55, "premium": 95},
      "Pantry & Wine": {"basic": 30, "standard": 50, "premium": 90},
      "Home Office": {"basic": 60, "standard": 90, "premium": 150},
      "Laundry Room": {"basic": 40, "standard": 65, "premium": 100},
      "Mudroom": {"basic": 45, "standard": 70, "premium": 115},
      "Entertainment Center": {"basic": 80, "standard": 120, "premium": 200},
      "Wall Beds": {"basic": 90, "standard": 130, "premium": 210},
      "Craft Room": {"basic": 35, "standard": 60, "premium": 95},
      "Home Library": {"basic": 75, "standard": 115, "premium": 185},
      "Kid Spaces": {"basic": 30, "standard": 45, "premium": 80},
      "Dressing Room": {"basic": 65, "standard": 100, "premium": 160},
      "Home Storage": {"basic": 40, "standard": 65, "premium": 105}
    }'::jsonb,
    disabled_default_rooms = garage_disabled,
    updated_at = now()
  where id = ironclad_tid;

  delete from public.contractor_rooms where contractor_id = ironclad_tid;
  insert into public.contractor_rooms
    (contractor_id, name, price_basic, price_standard, price_premium)
  values
    (ironclad_tid, 'Workshop Wall', 55, 90, 150);

  -- ── Hearth widget (mudroom / sq ft language) ─────────────────────────────
  update public.contractor_settings
  set
    company_name = 'Hearth & Home Spaces',
    industry = 'Mudrooms & Pantries',
    primary_color_hex = '#7c2d12',
    price_drawer = 0,
    price_shoe_rack = 0,
    domain_config = '{
      "categoryLabel": "Space",
      "unitLabel": "Square Feet",
      "unitAbbrev": "sq ft",
      "tierLabel": "Package",
      "pricingModel": "per_unit",
      "unitMin": 20,
      "unitMax": 200,
      "baseFee": 0
    }'::jsonb,
    tier_names = '{"basic":"Practical","standard":"Family","premium":"Heirloom"}'::jsonb,
    room_pricing = '{
      "Mudroom": {"basic": 45, "standard": 70, "premium": 115},
      "Laundry Room": {"basic": 40, "standard": 65, "premium": 100},
      "Pantry & Wine": {"basic": 30, "standard": 50, "premium": 90},
      "Walk-In Closet": {"basic": 45, "standard": 75, "premium": 140},
      "Reach-In Closet": {"basic": 35, "standard": 55, "premium": 95},
      "Garage": {"basic": 70, "standard": 110, "premium": 180},
      "Home Office": {"basic": 60, "standard": 90, "premium": 150},
      "Entertainment Center": {"basic": 80, "standard": 120, "premium": 200},
      "Wall Beds": {"basic": 90, "standard": 130, "premium": 210},
      "Craft Room": {"basic": 35, "standard": 60, "premium": 95},
      "Home Library": {"basic": 75, "standard": 115, "premium": 185},
      "Kid Spaces": {"basic": 30, "standard": 45, "premium": 80},
      "Dressing Room": {"basic": 65, "standard": 100, "premium": 160},
      "Home Storage": {"basic": 40, "standard": 65, "premium": 105}
    }'::jsonb,
    disabled_default_rooms = hearth_disabled,
    updated_at = now()
  where id = hearth_tid;

  -- ── Lumina site content ──────────────────────────────────────────────────
  update public.site_configs
  set
    layout_style = 'trust-builder',
    design_variant = 'atelier',
    default_room = 'Walk-In Closet',
    hero_config = '{
      "headline": "Walk-in closets built like dressing rooms",
      "subheadline": "Custom storage for Nashville master suites — lighting, finishes, and layout planned around your wardrobe.",
      "backgroundImage": "/brands/lumina/hero.png",
      "primaryCta": {"label": "View our closets", "href": "#portfolio"}
    }'::jsonb,
    about_config = '{
      "description": "Lumina builds custom closets and dressing rooms for Nashville homes. We measure the space, plan around how you actually hang and fold clothes, and install cabinetry with integrated lighting and soft-close hardware."
    }'::jsonb,
    process_config = '{
      "title": "How we work",
      "subtitle": "Measure, design, install",
      "steps": [
        {"number": "01", "title": "In-home measure", "description": "We walk the closet with you, note hanging vs folded storage, and mark studs and outlets."},
        {"number": "02", "title": "Layout & finishes", "description": "You pick materials and hardware; we send a scaled layout before we cut anything."},
        {"number": "03", "title": "Install day", "description": "Crew installs floor-to-ceiling, cleans up, and walks you through every drawer and rod."}
      ]
    }'::jsonb,
    before_after_config = '{
      "beforeImage": "/brands/lumina/before.png",
      "afterImage": "/brands/lumina/after-closet.png"
    }'::jsonb,
    seo_config = jsonb_set(
      jsonb_set(
        coalesce(seo_config, '{}'::jsonb),
        '{phone}',
        '""'::jsonb,
        true
      ),
      '{socialProof}',
      '{
        "eyebrow": "From recent installs",
        "headline": "What Nashville homeowners say",
        "stats": [],
        "testimonials": [
          {"quote": "They rebuilt our master walk-in around my shoes and his suits. Lighting alone made the room feel twice as big.", "name": "Megan R.", "detail": "Green Hills"},
          {"quote": "Install took one day. Soft-close drawers, no leftover hardware boxes, and they labeled every shelf.", "name": "David K.", "detail": "Belle Meade"},
          {"quote": "We finally see every sweater. The glass fronts were worth it for the jewelry drawers.", "name": "Priya S.", "detail": "12South"}
        ]
      }'::jsonb,
      true
    )
  where tenant_id = lumina_tid;

  -- ── Ironclad site content ────────────────────────────────────────────────
  update public.site_configs
  set
    layout_style = 'visual-impact',
    design_variant = 'obsidian',
    default_room = 'Garage',
    hero_config = '{
      "headline": "Garage storage that holds up to daily use",
      "subheadline": "Steel cabinetry, slatwall, and epoxy floors for workshops and car bays across Middle Tennessee.",
      "backgroundImage": "/brands/ironclad/hero.png",
      "primaryCta": {"label": "See garage builds", "href": "#portfolio"}
    }'::jsonb,
    about_config = '{
      "description": "Ironclad outfits garages for people who work in them. We hang steel cabinets, mount slatwall for tools, and pour metallic epoxy floors that shrug off hot tires and oil."
    }'::jsonb,
    process_config = '{
      "title": "The build sequence",
      "subtitle": "Heavy-duty from slab to wall",
      "steps": [
        {"number": "01", "title": "Site check", "description": "We check studs, floor slope, and power so the cabinet run sits square and secure."},
        {"number": "02", "title": "Prep", "description": "Concrete gets ground and patched; walls get blocking for the load."},
        {"number": "03", "title": "Install", "description": "Cabinets, slatwall, and epoxy go in on a tight schedule so you can park again fast."}
      ]
    }'::jsonb,
    before_after_config = '{
      "beforeImage": "/brands/ironclad/before.png",
      "afterImage": "/brands/ironclad/after-garage.png"
    }'::jsonb,
    seo_config = jsonb_set(
      jsonb_set(
        coalesce(seo_config, '{}'::jsonb),
        '{phone}',
        '""'::jsonb,
        true
      ),
      '{socialProof}',
      '{
        "eyebrow": "Shop numbers",
        "headline": "Built for people who wrench",
        "stats": [
          {"value": "12+", "label": "Years in Nashville"},
          {"value": "240+", "label": "Garage walls built"}
        ],
        "testimonials": [
          {"quote": "My bay went from pile-of-bins to a wall of steel drawers. Slatwall holds the impacts; epoxy still looks new after two winters of salt.", "name": "Chris M.", "detail": "East Nashville shop"}
        ]
      }'::jsonb,
      true
    )
  where tenant_id = ironclad_tid;

  -- ── Hearth site content ──────────────────────────────────────────────────
  update public.site_configs
  set
    layout_style = 'local-expert',
    design_variant = 'pavilion',
    default_room = 'Mudroom',
    hero_config = '{
      "headline": "Mudrooms and pantries for busy families",
      "subheadline": "Built-in lockers, cubbies, and pantry pull-outs for Franklin and Nashville suburbs.",
      "backgroundImage": "/brands/hearth/hero.png",
      "primaryCta": {"label": "See mudroom work", "href": "#portfolio"}
    }'::jsonb,
    about_config = '{
      "description": "Hearth & Home builds the rooms that catch the chaos — mudroom lockers, laundry folding counters, and pantries with pull-outs so backpacks, coats, and groceries have a place."
    }'::jsonb,
    process_config = '{
      "title": "From drop zone to done",
      "subtitle": "A simple three-step path",
      "steps": [
        {"number": "01", "title": "Home visit", "description": "We watch how your family comes through the door and where the piles form."},
        {"number": "02", "title": "Custom layout", "description": "Lockers, hooks, and shelves sized for kids and adults, in finishes that match your trim."},
        {"number": "03", "title": "Clean install", "description": "We build on site, haul debris, and leave the space ready for Monday morning."}
      ]
    }'::jsonb,
    before_after_config = '{
      "beforeImage": "/brands/hearth/before.png",
      "afterImage": "/brands/hearth/after-mudroom.png"
    }'::jsonb,
    seo_config = jsonb_set(
      jsonb_set(
        coalesce(seo_config, '{}'::jsonb),
        '{phone}',
        '""'::jsonb,
        true
      ),
      '{socialProof}',
      '{
        "eyebrow": "Neighbors talking",
        "headline": "Franklin families who use it every day",
        "stats": [],
        "testimonials": [
          {"quote": "Backpacks finally have a locker. Shoes stopped migrating into the kitchen.", "name": "Allison T.", "detail": "Franklin"},
          {"quote": "The pantry pull-outs mean I see the spices without a step stool.", "name": "Jordan P.", "detail": "Brentwood"},
          {"quote": "Laundry room folding counter is the size we needed. Kids can put away their own towels now.", "name": "Sam H.", "detail": "Nolensville"}
        ]
      }'::jsonb,
      true
    )
  where tenant_id = hearth_tid;
end
$demo$;
