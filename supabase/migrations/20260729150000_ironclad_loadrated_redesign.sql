-- =============================================================================
-- Ironclad "Load-Rated" bespoke redesign
--
-- Replaces the dark brutalist look (near-black + acid yellow, AI hero photo
-- with garbled baked-in text) with the hand-built light-industrial identity:
--   * theme 'garage-loadrated' (powder-coat gray / graphite / tool red) —
--     a bespoke theme added to the renderer for this tenant only
--   * design_variant 'foundry' (masthead hero: ruled brand line, big
--     headline, full-width image band — an engineering title block in spirit)
--   * hero image is a drawn shop elevation (dimension lines, part callouts,
--     title block) committed at /brands/ironclad/hero-elevation.png — what a
--     customer actually approves in step 2 of the process
--   * copy rewritten around specs and installed prices, not hype
-- =============================================================================

do $demo$
declare
  ironclad_tid uuid;
begin
  select t.id into ironclad_tid
  from public.domains d
  join public.tenants t on t.id = d.tenant_id
  where lower(d.hostname) in ('ironclad.ditchtheform.com', 'ironclad.closetquotes.com', 'ironclad.localhost')
  order by case when d.hostname like '%.ditchtheform.com' then 0 else 1 end
  limit 1;

  if ironclad_tid is null then
    raise exception 'Ironclad demo tenant not found';
  end if;

  update public.site_configs
  set
    theme = 'garage-loadrated',
    design_variant = 'foundry',
    hero_config = '{
      "headline": "Bolted to the studs. Built around your gear.",
      "subheadline": "14-gauge steel cabinets and 1,500 lb-rated shelving, drawn to your wall and installed in a day. Priced per linear foot — before we ever visit.",
      "backgroundImage": "/brands/ironclad/hero-elevation.png",
      "primaryCta": {"label": "Price your wall", "href": "#quote"}
    }'::jsonb,
    about_config = '{
      "description": "Ironclad outfits garages for people who work in them. Cabinet bodies are 14-gauge steel, shelves carry 1,500 pounds, and every run is bolted to the studs — not the drywall. You approve a dimensioned shop drawing before any steel is cut, and you know the installed price per linear foot up front."
    }'::jsonb,
    process_config = '{
      "title": "The build sequence",
      "subtitle": "Measured, drawn, bolted down",
      "signatureMotif": "bar",
      "steps": [
        {"number": "01", "title": "Site check", "description": "We measure the wall run, mark studs, and check slab slope and outlets so the cabinet run sits square."},
        {"number": "02", "title": "Shop drawing", "description": "You approve a dimensioned elevation — every cabinet, rail, and clearance on paper — before steel is cut."},
        {"number": "03", "title": "Install day", "description": "Cabinets bolted to the studs, slatwall loaded, floor cleared. You park inside that night."}
      ]
    }'::jsonb,
    seo_config = jsonb_set(
      coalesce(seo_config, '{}'::jsonb),
      '{socialProof}',
      '{
        "eyebrow": "Shop numbers",
        "headline": "Built for people who wrench",
        "stats": [
          {"value": "14-GA", "label": "Steel cabinet bodies"},
          {"value": "1,500 LB", "label": "Rated per shelf"},
          {"value": "1 DAY", "label": "Typical install"}
        ],
        "testimonials": [
          {"quote": "My bay went from pile-of-bins to a wall of steel drawers. Slatwall holds the impacts; epoxy still looks new after two winters of salt.", "name": "Chris M.", "detail": "East Nashville shop"}
        ]
      }'::jsonb,
      true
    )
  where tenant_id = ironclad_tid;

  -- Widget accent follows the theme's tool-red (was near-black).
  update public.contractor_settings
  set primary_color_hex = '#b91c1c', updated_at = now()
  where id = ironclad_tid;
end
$demo$;
