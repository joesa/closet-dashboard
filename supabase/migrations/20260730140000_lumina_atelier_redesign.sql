-- =============================================================================
-- Lumina "Atelier" bespoke redesign
--
-- Replaces the generic "luxury-minimal" look (shared theme, seed-picked to the
-- plainest preset in the pool) with a hand-built cabinetmaker's-atelier identity:
--   * theme 'lumina-atelier' (warm plaster / ink / one desaturated brass
--     accent) — a bespoke theme added to the renderer for this tenant only
--   * design_variant 'verdant' (framed hero + aside about + framed portfolio +
--     transparent-to-solid nav — a consistent "gallery window" composition,
--     distinct from Ironclad's newspaper-masthead pick)
--   * before/after replaced entirely: the old pair (a damaged reach-in closet
--     vs. a duplicate of a jewelry-drawer product shot — never the same room)
--     is swapped for two drawings of the SAME 6'-6" niche — field survey vs.
--     as-built elevation — sharing exact wall geometry, committed at
--     /brands/lumina/wall-before.png + wall-after.png
--   * every section rewritten around concrete specifics (tolerances, finishes,
--     lead times, hardware) instead of generic luxury adjectives
--   * social-proof testimonial key fixed: seo_config wrote "detail" but
--     SocialProofSection.tsx reads "role", so the neighborhood tag was
--     silently never rendering
-- =============================================================================

do $demo$
declare
  lumina_tid uuid;
begin
  select t.id into lumina_tid
  from public.domains d
  join public.tenants t on t.id = d.tenant_id
  where lower(d.hostname) in ('lumina.ditchtheform.com', 'lumina.closetquotes.com', 'lumina.localhost')
  order by case when d.hostname like '%.ditchtheform.com' then 0 else 1 end
  limit 1;

  if lumina_tid is null then
    raise exception 'Lumina demo tenant not found';
  end if;

  update public.site_configs
  set
    theme = 'lumina-atelier',
    design_variant = 'verdant',
    hero_config = '{
      "headline": "Closets drawn before they are built",
      "subheadline": "Floor-to-ceiling cabinetry for Nashville master suites. You approve a dimensioned elevation before we cut a single panel, and every drawer closes on a soft-close glide.",
      "backgroundImage": "/brands/lumina/hero.png",
      "primaryCta": {"label": "View our closets", "href": "#portfolio"}
    }'::jsonb,
    about_config = '{
      "description": "Lumina builds floor-to-ceiling closet systems for Nashville homes, measured to the quarter-inch and drawn before any panel is cut. Every run ships with soft-close hardware, integrated 2700K lighting, and your choice of five finishes — white oak, walnut, matte lacquer, high-gloss acrylic, or brushed brass hardware on any of them. You get the same dimensioned shop drawing shown in our before-and-after below."
    }'::jsonb,
    process_config = '{
      "title": "How we work",
      "subtitle": "Measured, drawn, installed",
      "steps": [
        {"number": "01", "title": "In-home measure", "description": "We measure every wall to the quarter-inch, note what hangs versus what folds, and mark studs and outlets before drawing anything."},
        {"number": "02", "title": "Shop drawing", "description": "You approve a dimensioned elevation — every shelf, drawer, and rod height on paper — before a single panel is cut."},
        {"number": "03", "title": "Install day", "description": "Crew installs floor-to-ceiling in a single day, labels every drawer and shelf, and leaves with every box and offcut."}
      ]
    }'::jsonb,
    products_config = '[
      {
        "title": "Valet & Jewelry Drawers",
        "image": "/brands/lumina/product-1.png",
        "description": "Felt-divided valet trays for watches and sunglasses, with a velvet-lined jewelry tier below on the same soft-close glide.",
        "details": {
          "subtitle": "Valet tier — divided trays",
          "specifications": [
            "Felt-lined compartment trays, custom-divided to your collection",
            "Soft-close, full-extension undermount glides",
            "Optional glass lid with brass piano hinge"
          ],
          "longDescription": "Built as the top tier of a dressing island or drawer stack, sized to the pieces you actually own rather than a stock insert. Compartment walls are placed after a walkthrough of your current collection, not a generic grid."
        }
      },
      {
        "title": "Walk-In Wardrobe Wall",
        "image": "/brands/lumina/product-3.png",
        "description": "Floor-to-ceiling glass-front uppers over open hanging, with a brushed-brass pull on every door and an LED toe-kick underfoot.",
        "details": {
          "subtitle": "Floor-to-ceiling wardrobe run",
          "specifications": [
            "3/4-inch furniture-grade panel core, five standard finishes",
            "Glass-front upper cabinets on soft-close hinges",
            "Brushed-brass pulls, integrated 2700K LED toe-kick"
          ],
          "longDescription": "A full wardrobe wall built around double- and single-hang zones sized to your actual wardrobe split, with glass-front uppers so out-of-season pieces stay visible instead of boxed."
        }
      },
      {
        "title": "Dressing Room Vanity & Desk",
        "image": "/brands/lumina/product-2.png",
        "description": "A floating oak desk built into the closet run for a vanity or dressing station, with concealed outlets and its own task lighting.",
        "details": {
          "subtitle": "Built-in vanity nook",
          "specifications": [
            "Floating desk in rift-sawn white oak veneer",
            "Concealed power + USB-C routed through the cabinet back",
            "Dedicated task lighting on a separate switch from the closet run"
          ],
          "longDescription": "Added to a dressing room or walk-in as a seated vanity or makeup station — same finish family as the surrounding cabinetry, wired before the drywall closes so there is never a visible cord."
        }
      }
    ]'::jsonb,
    before_after_config = '{
      "beforeImage": "/brands/lumina/wall-before.png",
      "afterImage": "/brands/lumina/wall-after.png",
      "title": "The same wall, before and after",
      "subtitle": "Job No. 24-0619 — field survey to as-built elevation"
    }'::jsonb,
    seo_config = jsonb_set(
      coalesce(seo_config, '{}'::jsonb),
      '{socialProof}',
      '{
        "eyebrow": "From recent installs",
        "headline": "What Nashville homeowners say",
        "stats": [
          {"value": "1/4-IN", "label": "Measured tolerance"},
          {"value": "6-8 WK", "label": "Typical lead time"},
          {"value": "2700K", "label": "Integrated LED, every run"}
        ],
        "testimonials": [
          {"quote": "They rebuilt our master walk-in around my shoes and his suits. Lighting alone made the room feel twice as big.", "name": "Megan R.", "role": "Green Hills"},
          {"quote": "Install took one day. Soft-close drawers, no leftover hardware boxes, and they labeled every shelf.", "name": "David K.", "role": "Belle Meade"},
          {"quote": "We finally see every sweater. The glass fronts were worth it for the jewelry drawers.", "name": "Priya S.", "role": "12South"}
        ]
      }'::jsonb,
      true
    )
  where tenant_id = lumina_tid;
end
$demo$;
