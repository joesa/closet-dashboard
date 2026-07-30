-- =============================================================================
-- Ironclad catalog plates + same-wall before/after
--
-- Finishes the Load-Rated redesign (see 20260729150000):
--   * products_config: the three AI stock photos with hype copy are replaced
--     by drawn catalog plates (IC-T30 / IC-SW8 / IC-B48, committed under
--     /brands/ironclad/catalog-*.png) with flat spec-sheet copy
--   * before_after_config: the mismatched pair (closet "before" vs. AI garage
--     "after") is replaced by two drawings of the SAME 18' wall — field survey
--     vs. as-built — sharing exact wall geometry so the slider reads as one
--     room by construction
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
    products_config = '[
      {
        "title": "IC-T Tall Lockers",
        "image": "/brands/ironclad/catalog-ict30.png",
        "description": "Full-height steel lockers for long tools, jackets, and bulk storage. 30-inch modules, lag-bolted to the studs.",
        "details": {
          "subtitle": "IC-T series — 30\" modules",
          "longDescription": "The IC-T30 is the workhorse of the line: a 14-gauge steel body with two louvered doors, adjustable shelving, and a plinth base that stands up to floor washdowns. Modules gang side by side to fill any run.",
          "specifications": [
            "30\" W x 84\" H x 24\" D per module",
            "14-gauge steel body, powder-coat finish",
            "Shelves rated 1,500 lb each",
            "Anchored to studs with 3/8\" lag bolts"
          ]
        }
      },
      {
        "title": "IC-SW Slatwall",
        "image": "/brands/ironclad/catalog-icsw8.png",
        "description": "Aluminum slatwall for the tools you reach for daily. Rails mount to studs; hooks and bins move without tools.",
        "details": {
          "subtitle": "IC-SW series — 8-foot sections",
          "longDescription": "Slatwall turns the space between bench and overheads into working storage. The extruded rail takes hooks, hangers, and bins anywhere along its length, so the wall reorganizes as the work changes.",
          "specifications": [
            "8''-0\" anodized aluminum sections",
            "Rated 220 lb per square foot",
            "Hooks and bins reposition without tools",
            "Mounted through drywall into studs"
          ]
        }
      },
      {
        "title": "IC-B Bench Run",
        "image": "/brands/ironclad/catalog-icb48.png",
        "description": "Base cabinets under a continuous worktop — a bench that doubles as heavy storage.",
        "details": {
          "subtitle": "IC-B series — 48\" modules",
          "longDescription": "Drawer and door bases in 48-inch modules under a top rated to 1,500 pounds. Levelers take out slab slope so drawers run true even on old concrete.",
          "specifications": [
            "48\" W x 36\" H modules, drawers or doors",
            "Worktop rated 1,500 lb",
            "Drawer slides rated 120 lb, full extension",
            "Levelers compensate up to 1\" of slab slope"
          ]
        }
      }
    ]'::jsonb,
    before_after_config = '{
      "beforeImage": "/brands/ironclad/wall-before.png",
      "afterImage": "/brands/ironclad/wall-after.png",
      "title": "The same wall, drawn to done",
      "subtitle": "Job 24-118 — field survey to as-built"
    }'::jsonb
  where tenant_id = ironclad_tid;
end
$demo$;
