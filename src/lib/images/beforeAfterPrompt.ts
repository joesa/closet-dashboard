import type { IndustrySlug } from '@/lib/catalog/types'

/**
 * Pure (client-safe) before/after subject classification + prompt building.
 * Shared by the server image pipeline (openai-images.ts) and the intake image
 * studio UI, which prefills the editable "before" art-direction prompt with
 * the same trade-aware text the server would use.
 */

/**
 * Space-type keywords mapped to a human-readable label used in the "before"
 * prompt so the messy scene feels like the same room as the "after" image.
 * Only consulted for the 'interior-space' before/after category.
 */
const SPACE_TYPE_MAP: Array<{ keywords: string[]; label: string }> = [
  { keywords: ['wine', 'cellar', 'bottle'], label: 'wine cellar' },
  { keywords: ['pantry', 'kitchen'], label: 'kitchen pantry' },
  { keywords: ['garage', 'workshop'], label: 'garage' },
  { keywords: ['mudroom', 'entryway'], label: 'mudroom' },
  { keywords: ['office', 'executive', 'desk'], label: 'home office' },
  { keywords: ['library', 'book'], label: 'home library' },
  { keywords: ['laundry', 'utility'], label: 'laundry room' },
  { keywords: ['entertainment', 'media', 'theater'], label: 'media room' },
  { keywords: ['kids', 'playful', 'playroom'], label: "kids' room" },
  { keywords: ['dressing', 'wardrobe', 'walk-in', 'walkin'], label: 'walk-in closet' },
]

export function inferSpaceType(afterImageUrl: string): string {
  const lower = afterImageUrl.toLowerCase()
  for (const { keywords, label } of SPACE_TYPE_MAP) {
    if (keywords.some((kw) => lower.includes(kw))) return label
  }
  return 'storage space' // generic fallback
}

/**
 * Broad subject category for a business's before/after transformation. The
 * "before" scene must depict the SAME kind of subject as the after image —
 * just worse — never an unrelated messy interior for a business whose actual
 * work is on vehicles, exteriors, or fixtures. (e.g. a car-wrapping shop's
 * "before" must be a dull, unwrapped car — not a garage full of boxes.)
 */
export type BeforeAfterCategory = 'vehicle' | 'exterior' | 'fixture' | 'pet' | 'interior-space' | 'not-applicable'

// Free-text keywords that strongly signal the vehicle category regardless of
// which industry slug the business resolved to (industries like
// "Signage & Vehicle Wraps" bundle both vehicle wraps and building signage,
// so the industry slug alone isn't a reliable enough signal).
const VEHICLE_TEXT_KEYWORDS = [
  'wrap', 'detailing', 'detail', 'tint', 'ppf', 'paint protection', 'ceramic coat',
  'car ', 'auto', 'vehicle', 'truck', 'van', 'fleet', 'boat', 'marine', 'rv ', 'motorcycle',
]

/**
 * Industry slug -> before/after subject category. This is `Record<IndustrySlug, ...>`
 * (NOT `Record<string, ...>`) *on purpose* — TypeScript will fail the build if a
 * new industry is ever added to the catalog (src/lib/catalog/types.ts's
 * `IndustrySlug` union) without an explicit entry here. This is the exact class
 * of bug that shipped 'pet-services' silently falling back to the generic
 * messy-room prompt (nonsensical when the reference photo is a dog): a
 * `Record<string, ...>` partial map compiles fine even when an industry is
 * missing, and the omission is invisible until someone notices the wrong image.
 * See `getBeforeAfterCategory()` below and `openai-images.test.ts`'s exhaustive
 * catalog-coverage test for a second, human-readable guard against this
 * drifting back to a partial map.
 *
 * `'not-applicable'` (added 2026-07-04): a "before/after transformation" photo
 * slider only makes narrative sense for a business that takes something from
 * a run-down/unfinished physical state to a refined one (an old car's paint
 * job -> a new one; a cluttered closet -> an organized one). It does NOT make
 * sense for direct-purchase/order businesses (a restaurant doesn't have a
 * "before" meal), pure professional/knowledge services (legal, financial,
 * consulting, IT, research, insurance, real estate — there's no physical
 * object the business transforms), ticketed/booking businesses (hotels,
 * tours, museums, theaters, amusement parks — nothing is "renovated" for the
 * customer), or medical/personal-care services where an actual before/after
 * would mean showing a real person's body/face looking "worse" (fitness,
 * personal training, massage, therapy, senior care, medical clinics — the
 * same likeness/identity concern that already excludes beauty-salon below).
 * `provisionTenant.ts` skips generating a before/after image AND the
 * renderer (`custom-closets-websites/ClientPage.tsx`) omits the before/after
 * section entirely when this category is set.
 */
const INDUSTRY_BEFORE_AFTER_CATEGORY: Record<IndustrySlug, BeforeAfterCategory> = {
  // Vehicle — same vehicle, dull/unfinished vs. finished
  'mobile-auto': 'vehicle',
  'auto-body': 'vehicle',
  'signage-wraps': 'vehicle',
  'limo-shuttle': 'vehicle',
  'hotshot-trucking': 'vehicle',
  'rv-boat-service': 'vehicle',
  'food-truck': 'vehicle',
  'towing': 'vehicle',
  'courier-delivery': 'vehicle',
  'medical-transport': 'vehicle',
  // Exterior — same yard/home exterior, neglected vs. maintained
  'landscaping': 'exterior',
  'roofing': 'exterior',
  'pressure-washing': 'exterior',
  'tree-service': 'exterior',
  'painting': 'exterior',
  'concrete-masonry': 'exterior',
  'pool-spa': 'exterior',
  'garage-door': 'exterior',
  'gutters': 'exterior',
  'irrigation': 'exterior',
  'solar': 'exterior',
  'windows-doors': 'exterior',
  'waterproofing': 'exterior',
  'foundation-repair': 'exterior',
  'siding': 'exterior',
  'fencing': 'exterior',
  'snow-removal': 'exterior',
  'outdoor-lighting': 'exterior',
  'deck-maintenance': 'exterior',
  'parking-lot': 'exterior',
  'pest-control': 'exterior',
  'drone-services': 'exterior',
  'bounce-house': 'exterior',
  // Fixture / equipment — same fixture, old & worn vs. new
  'plumbing': 'fixture',
  'hvac': 'fixture',
  'electrical': 'fixture',
  'appliance-repair': 'fixture',
  'locksmith': 'fixture',
  'chimney-fireplace': 'fixture',
  'security-systems': 'fixture',
  'generator-services': 'fixture',
  'countertops': 'fixture',
  'cabinet-painting': 'fixture',
  'epoxy-flooring': 'fixture',
  'septic-services': 'fixture',
  'well-services': 'fixture',
  'water-treatment': 'fixture',
  'glass-mirror': 'fixture',
  'blinds-shutters': 'fixture',
  'duct-cleaning': 'fixture',
  'fire-protection': 'fixture',
  'commercial-refrigeration': 'fixture',
  'restaurant-equipment': 'fixture',
  'welding-fabrication': 'fixture',
  'elevator-services': 'fixture',
  'it-computer-repair': 'fixture',
  'carpentry': 'fixture',
  'flooring': 'fixture',
  'drywall': 'fixture',
  'insulation': 'fixture',
  'tile-grout-cleaning': 'fixture',
  // Pet — same animal, dirty/unkempt vs. clean & groomed
  'pet-services': 'pet',
  // Interior space — same room, cluttered/damaged/unfinished vs. finished.
  // Includes the original closet/storage use case, whole-room remodels, and
  // service businesses with no natural single-object "before" prop (personal
  // services, admin/paperwork, entertainment booking) where a generic room
  // scene is the least-wrong default.
  'custom-closets': 'interior-space',
  'cleaning': 'interior-space',
  'handyman': 'interior-space',
  'moving': 'interior-space',
  'junk-removal': 'interior-space',
  'home-inspection': 'interior-space',
  'bathroom-remodel': 'interior-space',
  'kitchen-remodel': 'interior-space',
  'mold-remediation': 'interior-space',
  'fire-restoration': 'interior-space',
  'mobile-notary': 'not-applicable',
  'personal-training': 'not-applicable',
  'massage-therapy': 'not-applicable',
  'tutoring': 'not-applicable',
  'catering-chef': 'not-applicable',
  'photography-video': 'not-applicable',
  'home-staging': 'interior-space',
  'event-rentals': 'interior-space',
  'dj-entertainment': 'not-applicable',
  // Fourth-wave industries — most are booking/ticketed or pure professional
  // services with no physical "before" prop, so 'not-applicable' correctly
  // skips before/after entirely (see the docstring above). A few genuinely
  // have a legit facility/venue transformation narrative and keep
  // 'interior-space' (event-planning, spa-wellness, laundry-services). Human
  // beauty/grooming (hair, nails, tattoos) is deliberately NOT given a
  // before/after treatment of the CLIENT'S body/face — editing a real
  // person's photo to look "worse" raises likeness/identity concerns that
  // don't apply to a pet or a car, so beauty-salon (and the same-reasoning
  // fitness-studio/personal-training/massage-therapy above) are
  // 'not-applicable' rather than substituting a facility photo.
  'hotel-lodging': 'not-applicable',
  'restaurants-bars': 'not-applicable',
  'tourism-travel': 'not-applicable',
  'event-planning': 'interior-space',
  'recreation-entertainment': 'not-applicable',
  'arts-culture': 'not-applicable',
  'legal-services': 'not-applicable',
  'financial-professionals': 'not-applicable',
  'business-consulting': 'not-applicable',
  'marketing-advertising': 'not-applicable',
  'it-services': 'not-applicable',
  'architecture-engineering': 'not-applicable',
  'research-services': 'not-applicable',
  'beauty-salon': 'not-applicable',
  'spa-wellness': 'interior-space',
  'fitness-studio': 'not-applicable',
  'life-services': 'not-applicable',
  'laundry-services': 'interior-space',
  'medical-clinic': 'not-applicable',
  'therapy-rehab': 'not-applicable',
  'senior-care': 'not-applicable',
  'education-formal': 'not-applicable',
  'enrichment-education': 'not-applicable',
  'banking-lending': 'not-applicable',
  'investment-services': 'not-applicable',
  'insurance-services': 'not-applicable',
  'real-estate-services': 'not-applicable',
  // Vehicle/exterior for the fourth-wave logistics industries.
  'passenger-transport': 'vehicle',
  'freight-logistics': 'vehicle',
  'waste-management': 'exterior',
}

/**
 * Public getter for INDUSTRY_BEFORE_AFTER_CATEGORY. Exists mainly so tests
 * (and any other caller) can verify every catalog industry resolves to a
 * category without reaching into a module-private table.
 */
export function getBeforeAfterCategory(slug: IndustrySlug): BeforeAfterCategory {
  return INDUSTRY_BEFORE_AFTER_CATEGORY[slug]
}

/** Vehicle noun to use in the before-prompt, inferred from free-text hints. */
function inferVehicleNoun(text: string): string {
  if (text.includes('boat') || text.includes('marine')) return 'boat'
  if (text.includes('rv')) return 'RV'
  if (text.includes('food truck')) return 'food truck'
  if (text.includes('truck') || text.includes('fleet')) return 'pickup truck'
  if (text.includes('van')) return 'cargo van'
  if (text.includes('motorcycle')) return 'motorcycle'
  return 'car'
}

/** Exterior feature noun to use in the before-prompt, inferred from free-text hints. */
function inferExteriorNoun(text: string): string {
  if (text.includes('roof')) return "a home's roof"
  if (text.includes('pool') || text.includes('spa')) return 'a backyard pool area'
  if (text.includes('driveway') || text.includes('concrete') || text.includes('parking')) return 'a concrete driveway'
  if (text.includes('deck')) return 'a backyard deck'
  if (text.includes('fence')) return 'a yard fence'
  if (text.includes('gutter')) return "a home's gutters and roofline"
  if (text.includes('garage door')) return 'a home garage door and driveway'
  if (text.includes('siding')) return "a home's exterior siding"
  if (text.includes('window') || text.includes('door')) return "a home's exterior windows"
  if (text.includes('lawn') || text.includes('landscap') || text.includes('yard') || text.includes('tree')) return 'a front yard and lawn'
  if (text.includes('drone') || text.includes('aerial')) return "an aerial view of a property"
  if (text.includes('bounce') || text.includes('inflatable')) return 'a backyard party setup'
  if (text.includes('pest') || text.includes('termite') || text.includes('rodent')) return "a home's exterior perimeter"
  return 'the exterior of a home'
}

/** Pet/animal noun to use in the before-prompt, inferred from free-text hints. */
function inferPetNoun(text: string): string {
  if (text.includes('cat')) return 'cat'
  if (text.includes('horse') || text.includes('equine')) return 'horse'
  return 'dog'
}

/** Fixture/equipment noun to use in the before-prompt, inferred from free-text hints. */
function inferFixtureNoun(text: string): string {
  if (text.includes('plumb') || text.includes('pipe') || text.includes('water heater')) return 'exposed plumbing pipes and a water heater'
  if (text.includes('hvac') || text.includes('furnace') || text.includes('air condition')) return 'an HVAC furnace and ductwork unit'
  if (text.includes('electric') || text.includes('panel') || text.includes('wiring')) return 'an electrical breaker panel and wiring'
  if (text.includes('lock') || text.includes('door hardware')) return 'a door lock and handle set'
  if (text.includes('chimney') || text.includes('fireplace')) return 'a fireplace and chimney'
  if (text.includes('security') || text.includes('camera') || text.includes('alarm')) return 'a home security panel'
  if (text.includes('counter')) return 'a kitchen countertop'
  if (text.includes('cabinet')) return 'kitchen cabinetry'
  if (text.includes('floor') || text.includes('epoxy')) return 'a garage floor'
  if (text.includes('glass') || text.includes('mirror') || text.includes('window')) return 'a window and glass pane'
  if (text.includes('blind') || text.includes('shutter')) return 'window blinds'
  if (text.includes('generator')) return 'a backup power generator'
  if (text.includes('refriger') || text.includes('restaurant equipment')) return 'a commercial refrigeration unit'
  if (text.includes('computer') || text.includes('it ') || text.includes('laptop')) return 'a computer and its internal hardware'
  if (text.includes('drywall')) return 'a section of drywall wall'
  if (text.includes('insulation') || text.includes('attic')) return 'attic insulation'
  if (text.includes('tile') || text.includes('grout')) return 'a tiled floor and grout lines'
  if (text.includes('carpentry') || text.includes('trim') || text.includes('molding') || text.includes('built-in')) return 'custom trim and built-in carpentry'
  if (text.includes('floor')) return 'a hardwood floor'
  return 'a mechanical fixture'
}

export type BeforeAfterContext = {
  industry?: string | null
  services?: string[] | null
  otherServices?: string | null
  /**
   * Category from a matching contractor-created custom industry (see
   * @/lib/catalog/customIndustries) — takes precedence over every other
   * signal below when present, since it's an explicit, validated answer
   * rather than a guess from free text.
   */
  beforeAfterCategoryOverride?: BeforeAfterCategory | null
}

/**
 * Classify the before/after subject category from whatever industry context
 * is available. Falls back to 'interior-space' (the original room/closet
 * behavior) when nothing more specific is known — this preserves behavior
 * for callers that don't pass any context.
 */
export function classifyBeforeAfterSubject(context?: BeforeAfterContext): {
  category: BeforeAfterCategory
  text: string
} {
  const text = [context?.industry, ...(context?.services ?? []), context?.otherServices]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .join(' ')
    .toLowerCase()

  if (context?.beforeAfterCategoryOverride) {
    return { category: context.beforeAfterCategoryOverride, text }
  }

  if (VEHICLE_TEXT_KEYWORDS.some((kw) => text.includes(kw))) {
    return { category: 'vehicle', text }
  }

  const industrySlugGuess = (context?.industry || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  // industrySlugGuess is a best-effort reconstruction from free text, not
  // guaranteed to be a real IndustrySlug — INDUSTRY_BEFORE_AFTER_CATEGORY is
  // deliberately typed as exhaustive over the real union (see its docstring),
  // so an unrecognized guess is looked up via a safe cast and simply falls
  // through to the 'interior-space' default below, same as before.
  const category = INDUSTRY_BEFORE_AFTER_CATEGORY[industrySlugGuess as IndustrySlug]
  return { category: category || 'interior-space', text }
}

/**
 * Build the trade-aware "before" art-direction prompt for an image-to-image
 * edit of the given "after" photo. The prompt instructs the model to keep the
 * EXACT SAME subject, angle, and framing — only the condition degrades — so
 * the before/after slider always compares the same scene.
 */
export function buildBeforeImagePrompt(
  afterImageUrl: string,
  context?: BeforeAfterContext
): string {
  const { category, text } = classifyBeforeAfterSubject(context)

  if (category === 'vehicle') {
    const vehicle = inferVehicleNoun(text)
    return (
      `This is the finished "AFTER" photo of a ${vehicle} detailing job. Transform it into the "BEFORE" photo ` +
      `of the SAME ${vehicle} in the SAME pose, angle, framing, and background. You MUST visibly degrade the ` +
      `paint condition — this is the whole point of the edit: strip away all gloss and reflections, make the ` +
      `paint look dull, hazy, and faded with heavy swirl marks, water spots, and road grime/dust film across ` +
      `every panel. Remove any wrap, ceramic coating, or graphics. The wheels should look dirty with visible ` +
      `brake dust. Do not leave the vehicle looking clean, shiny, or freshly detailed — it must clearly look ` +
      `neglected and due for service. Keep the same vehicle model, color, and composition. Realistic ` +
      `automotive photograph. No people, no text, no logos, no branding.`
    )
  }
  if (category === 'exterior') {
    const feature = inferExteriorNoun(text)
    return (
      `This is the finished "AFTER" photo showing a completed job on ${feature}. Transform it into the ` +
      `"BEFORE" photo of the SAME scene, structure, angle, and framing. You MUST visibly degrade the ` +
      `condition — this is the whole point of the edit: add overgrown weeds, faded and peeling paint or ` +
      `stain, cracked and stained surfaces, discoloration, moss/grime buildup, and general disrepair. Do not ` +
      `leave it looking clean, maintained, or freshly finished — it must clearly look neglected and overdue ` +
      `for the work this business does. Keep the same structure and composition. Realistic exterior ` +
      `photograph. No people, no text, no logos.`
    )
  }
  if (category === 'fixture') {
    const fixture = inferFixtureNoun(text)
    return (
      `This is the finished "AFTER" photo showing a completed job on ${fixture}. Transform it into the ` +
      `"BEFORE" photo of the SAME fixture, angle, and framing. You MUST visibly degrade the condition — ` +
      `this is the whole point of the edit: make it look visibly outdated, corroded, rusted, or damaged, ` +
      `with dust and grime built up and signs of age. Do not leave it looking new, clean, or freshly ` +
      `installed — it must clearly look old and neglected. Keep the same fixture and composition. Realistic ` +
      `close-up photograph. No people, no text, no logos.`
    )
  }
  if (category === 'pet') {
    const animal = inferPetNoun(text)
    return (
      `This is the finished "AFTER" photo of a freshly groomed ${animal} — clean, brushed, trimmed coat, ` +
      `and happy. Transform it into the "BEFORE" photo of the EXACT SAME ${animal} (same breed, coloring, ` +
      `size, and markings) in the SAME pose, angle, framing, and background/setting. You MUST visibly ` +
      `degrade its groomed condition — this is the whole point of the edit: make the coat look dirty, ` +
      `matted, tangled, and unevenly overgrown, with visible mud/grime stains, tear stains, and a generally ` +
      `scruffy, unkempt appearance. Do not leave the ${animal} looking clean, brushed, or freshly groomed — ` +
      `it must clearly look like it badly needs a grooming appointment. Keep the SAME individual animal, ` +
      `pose, and composition — do not change species, breed, or scene. Realistic pet photograph. No people, ` +
      `no text, no logos.`
    )
  }

  const spaceType = inferSpaceType(afterImageUrl)
  return (
    `This is the finished "AFTER" photo of a custom ${spaceType} installation. Transform it into the ` +
    `"BEFORE" photo of the SAME room, dimensions, layout, and camera angle. You MUST replace the ` +
    `organized custom cabinetry/built-ins entirely — this is the whole point of the edit: show cheap wire ` +
    `shelving sagging under random junk, cardboard moving boxes stacked haphazardly with flaps open, loose ` +
    `items scattered on the floor, bare drywall with scuff marks and water stains, and a single harsh ` +
    `bare-bulb overhead light. Do not leave any organized storage, built-ins, or finished cabinetry visible — ` +
    `it must clearly look cramped, dim, and completely disorganized. Keep the same room shape and camera ` +
    `angle. Realistic interior photograph. No people, no text, no logos.`
  )
}
