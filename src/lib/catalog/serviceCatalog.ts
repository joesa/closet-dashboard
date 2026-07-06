import {
  ALL_SERVICES,
  INDUSTRIES,
  INDUSTRY_BY_SLUG,
} from '@/lib/catalog/industries/index'
import type { IndustryDef, IndustrySlug, ServiceDef, EngagementModel } from '@/lib/catalog/types'
import {
  DEFAULT_LAYOUT,
  DEFAULT_THEME,
  type LayoutSlug,
  LAYOUT_SLUGS,
  type ThemeSlug,
  THEME_LAYOUT_AFFINITY,
  THEME_SLUGS,
} from '@/lib/catalog/sitePresentationCatalog'
import type { PricingModel } from '@/lib/rooms'

export function normalizeCatalogText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function scoreServiceMatch(input: string, def: ServiceDef): number {
  const norm = normalizeCatalogText(input)
  if (!norm) return 0

  const label = normalizeCatalogText(def.label)
  let score = 0

  if (norm === label) score += 20
  else if (norm.includes(label) || label.includes(norm)) score += 10

  for (const kw of def.keywords) {
    const k = normalizeCatalogText(kw)
    if (!k) continue
    if (norm === k) score += 12
    else if (norm.includes(k)) score += 6
  }

  return score
}

export function getIndustry(slug: IndustrySlug): IndustryDef {
  return INDUSTRY_BY_SLUG[slug]
}

/**
 * Deterministic quote-vs-order detection: a catalog lookup, not a runtime AI
 * guess — the business's resolved industry already tells you which
 * interaction model fits (see EngagementModel in catalog/types.ts).
 * Defaults to 'quote' (today's status quo) when the industry doesn't
 * explicitly opt into 'order'.
 */
export function getEngagementModel(slug: IndustrySlug): EngagementModel {
  return INDUSTRY_BY_SLUG[slug]?.engagementModel ?? 'quote'
}

export function listIndustries(): IndustryDef[] {
  return INDUSTRIES
}

export function resolveIndustrySlug(input: {
  industry?: string | null
  services?: string[] | null
  other_services?: string | null
}): IndustrySlug {
  const industryText = normalizeCatalogText(input.industry || '')
  if (industryText) {
    let best: { slug: IndustrySlug; score: number } | undefined
    for (const ind of INDUSTRIES) {
      let score = 0
      const normalizedSlug = normalizeCatalogText(ind.slug)
      if (normalizeCatalogText(ind.label) === industryText) score += 20
      if (industryText.includes(normalizedSlug)) score += 8
      for (const kw of ind.keywords) {
        const k = normalizeCatalogText(kw)
        // Skip a keyword that's just a restatement of the industry's own
        // slug (e.g. slug 'cleaning' + keyword 'cleaning', or slug
        // 'duct-cleaning' + keyword 'duct cleaning') — otherwise the same
        // substring match gets counted twice (once via the slug bonus above,
        // once via the keyword loop), letting broad generic industries
        // (like 'cleaning') out-score a more specific industry's genuinely
        // distinct keyword matches on every "<specialty> cleaning" phrase.
        if (k === normalizedSlug) continue
        if (industryText.includes(k)) score += 6
      }
      if (score > (best?.score ?? 0)) best = { slug: ind.slug, score }
    }
    if (best && best.score >= 6) return best.slug
  }

  const labels = [
    ...(input.services ?? []),
    ...(input.other_services ? [input.other_services] : []),
  ].filter(Boolean)

  const scores = new Map<IndustrySlug, number>()
  for (const label of labels) {
    const def = matchServiceDef(label)
    if (def) {
      scores.set(def.industry, (scores.get(def.industry) ?? 0) + 10)
    }
  }

  let top: IndustrySlug | undefined
  let topScore = 0
  for (const [slug, score] of scores) {
    if (score > topScore) {
      topScore = score
      top = slug
    }
  }
  return top ?? 'custom-closets'
}

/**
 * True when `resolveIndustrySlug` has ZERO real signal to work with — the
 * industry text never scored >=6 against any catalog industry, AND no
 * service/other-service label matched any catalog ServiceDef either. This is
 * a stronger signal than "the theme pool ended up generic" (industry.defaultThemes
 * is virtually always non-empty), so it's used to decide when a synthesized
 * (last-resort) theme is worth generating instead of the fixed top-8 pool.
 */
export function isLowConfidenceResolution(input: {
  industry?: string | null
  services?: string[] | null
  other_services?: string | null
}): boolean {
  const industryText = normalizeCatalogText(input.industry || '')
  if (industryText) {
    for (const ind of INDUSTRIES) {
      let score = 0
      if (normalizeCatalogText(ind.label) === industryText) score += 20
      if (industryText.includes(normalizeCatalogText(ind.slug))) score += 8
      for (const kw of ind.keywords) {
        if (industryText.includes(normalizeCatalogText(kw))) score += 6
      }
      if (score >= 6) return false
    }
  }

  const labels = [
    ...(input.services ?? []),
    ...(input.other_services ? [input.other_services] : []),
  ].filter(Boolean)
  return !labels.some((label) => !!matchServiceDef(label))
}

export function matchServiceDef(
  label: string,
  industrySlug?: IndustrySlug
): ServiceDef | undefined {
  const candidates = industrySlug
    ? getIndustry(industrySlug).services
    : ALL_SERVICES

  let best: { def: ServiceDef; score: number } | undefined
  for (const def of candidates) {
    const score = scoreServiceMatch(label, def)
    if (score > (best?.score ?? 0)) best = { def, score }
  }
  if (best && best.score >= 6) return best.def
  return undefined
}

/** Backward-compatible exact-label lookup across all industries. */
export function getServiceDef(label: string): ServiceDef | undefined {
  const exact = ALL_SERVICES.find((s) => s.label === label)
  if (exact) return exact
  return matchServiceDef(label)
}

export function servicesForIndustry(slug: IndustrySlug): ServiceDef[] {
  return getIndustry(slug).services
}

export function servicesByGroup(
  slug: IndustrySlug = 'custom-closets'
): Map<string, ServiceDef[]> {
  const industry = getIndustry(slug)
  const map = new Map<string, ServiceDef[]>()
  for (const g of industry.serviceGroups) map.set(g, [])
  for (const s of industry.services) {
    if (!map.has(s.group)) map.set(s.group, [])
    map.get(s.group)!.push(s)
  }
  return map
}

export function getServiceCatalogEntry(
  serviceName: string
): { image: string; description: string } {
  const def = getServiceDef(serviceName)
  if (def) return def.catalog
  return {
    image: 'https://images.unsplash.com/photo-1558211583-d26f610c1eb1',
    description: 'Premium professional service tailored to your needs.',
  }
}

export function widgetCategoryForService(label: string): string {
  return getServiceDef(label)?.widgetCategory ?? label
}

const OTHER_SERVICE_HINTS: Array<{
  match: RegExp
  themes: ThemeSlug[]
  layouts?: LayoutSlug[]
  widgetCategory?: string
}> = [
  {
    match: /wine|cellar|tasting/i,
    themes: ['sophisticated-wine', 'wine-cellar', 'rustic-pantry'],
    widgetCategory: 'Pantry & Wine',
  },
  {
    match: /garage|slatwall|epoxy/i,
    themes: ['garage-industrial', 'brutalist', 'functional-utility'],
    layouts: ['visual-impact', 'conversion-focus'],
    widgetCategory: 'Garage',
  },
  {
    match: /mudroom|entry|locker/i,
    themes: ['mudroom-family'],
    layouts: ['local-expert'],
    widgetCategory: 'Mudroom',
  },
  {
    match: /murphy|wall bed/i,
    themes: ['modern-office'],
    layouts: ['compact-quote'],
    widgetCategory: 'Wall Beds',
  },
  {
    match: /commercial|office storage/i,
    themes: ['commercial-pro'],
    layouts: ['trust-builder'],
    widgetCategory: 'Commercial',
  },
]

export function collectThemeLayoutPools(input: {
  services?: string[] | null
  other_services?: string | null
  industry?: string | null
}): {
  industry: IndustrySlug
  themes: ThemeSlug[]
  layouts: LayoutSlug[]
} {
  const industrySlug = resolveIndustrySlug(input)
  const industry = getIndustry(industrySlug)
  const themeSet = new Set<ThemeSlug>()
  const layoutSet = new Set<LayoutSlug>()

  const serviceLabels = (input.services ?? []).filter(Boolean)

  for (const label of serviceLabels) {
    const def = matchServiceDef(label, industrySlug) ?? matchServiceDef(label)
    if (!def) continue
    def.recommendedThemes.forEach((t) => themeSet.add(t))
    def.recommendedLayouts.forEach((l) => layoutSet.add(l))
  }

  const other = (input.other_services || '').trim()
  if (other) {
    for (const hint of OTHER_SERVICE_HINTS) {
      if (!hint.match.test(other)) continue
      hint.themes.forEach((t) => themeSet.add(t))
      hint.layouts?.forEach((l) => layoutSet.add(l))
    }
  }

  if (themeSet.size === 0) {
    industry.defaultThemes.forEach((t) => themeSet.add(t))
  }
  if (layoutSet.size === 0) {
    industry.defaultLayouts.forEach((l) => layoutSet.add(l))
  }

  if (themeSet.size === 0) {
    THEME_SLUGS.slice(0, 8).forEach((t) => themeSet.add(t))
  }
  if (layoutSet.size === 0) {
    ;['standard', 'conversion-focus', 'portfolio-first'].forEach((l) =>
      layoutSet.add(l as LayoutSlug)
    )
  }

  return {
    industry: industrySlug,
    themes: [...themeSet],
    layouts: [...layoutSet],
  }
}

/** Narrow layout pool to layouts that pair well with a chosen theme. */
export function layoutsForTheme(theme: ThemeSlug, layouts: LayoutSlug[]): LayoutSlug[] {
  const affinity = THEME_LAYOUT_AFFINITY[theme] ?? LAYOUT_SLUGS
  const filtered = layouts.filter((l) => affinity.includes(l))
  return filtered.length > 0 ? filtered : [...layouts]
}

/**
 * Deterministic 32-bit FNV-1a hash used to rotate among equally-ranked
 * theme/layout candidates so different businesses in the same vertical diverge
 * instead of always landing on the first pool entry. Stable across runtimes.
 */
function hashSeedString(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export function pickBestTheme(
  themes: ThemeSlug[],
  vibe?: string | null,
  vibeMap?: Record<string, ThemeSlug>,
  seed?: string | null
): ThemeSlug {
  // Honor explicit vibe intent first — a stated vibe pins the theme.
  if (vibe && vibeMap?.[vibe] && themes.includes(vibeMap[vibe])) {
    return vibeMap[vibe]
  }
  if (themes.length === 0) return DEFAULT_THEME
  // No strong signal: every candidate ties, so rotate deterministically by a
  // stable seed (e.g. business name) instead of always picking the first entry.
  const key = (seed ?? '').trim()
  if (key) {
    return themes[hashSeedString(key) % themes.length]
  }
  return themes[0] ?? DEFAULT_THEME
}

export function pickBestLayout(
  layouts: LayoutSlug[],
  theme: ThemeSlug,
  cta?: string | null,
  ctaMap?: Record<string, LayoutSlug>,
  seed?: string | null
): LayoutSlug {
  const themeLayouts = layoutsForTheme(theme, layouts)
  // Honor explicit CTA intent first.
  if (cta && ctaMap?.[cta] && themeLayouts.includes(ctaMap[cta])) {
    return ctaMap[cta]
  }
  if (themeLayouts.length === 0) return DEFAULT_LAYOUT
  const key = (seed ?? '').trim()
  if (key) {
    // Salt so layout selection is not correlated with theme selection.
    return themeLayouts[hashSeedString(`${key}:layout`) % themeLayouts.length]
  }
  return themeLayouts[0] ?? DEFAULT_LAYOUT
}

export function inferWidgetCategory(
  services: string[],
  otherServices?: string | null,
  industrySlug?: IndustrySlug
): string {
  const slug = industrySlug ?? resolveIndustrySlug({ services, other_services: otherServices })
  const primary = services.find((s) => s && !s.startsWith('Other')) || services[0]
  if (primary) {
    const def = matchServiceDef(primary, slug) ?? matchServiceDef(primary)
    if (def) return def.widgetCategory
  }
  const other = (otherServices || '').trim()
  if (other) {
    for (const hint of OTHER_SERVICE_HINTS) {
      if (hint.match.test(other) && hint.widgetCategory) return hint.widgetCategory
    }
  }
  return getIndustry(slug).services[0]?.widgetCategory ?? 'General Service'
}

export interface IndustryConfig {
  categoryLabel: string
  unitLabel: string
  unitAbbrev: string
  tierLabel: string
  pricingModel?: PricingModel
  unitMin?: number
  unitMax?: number
  baseFee?: number
}

export const INDUSTRY_CONFIGS: Record<IndustrySlug, IndustryConfig> = {
  'custom-closets': { categoryLabel: 'Room', unitLabel: 'Linear Feet', unitAbbrev: 'ft', tierLabel: 'Finish' },
  'plumbing': { categoryLabel: 'Service', unitLabel: 'Project Scope', unitAbbrev: 'job', tierLabel: 'Package', pricingModel: 'flat_tiered', unitMin: 1, unitMax: 1 },
  'hvac': { categoryLabel: 'Service', unitLabel: 'Project Scope', unitAbbrev: 'job', tierLabel: 'Package', pricingModel: 'flat_tiered', unitMin: 1, unitMax: 1 },
  'landscaping': { categoryLabel: 'Service', unitLabel: 'Area', unitAbbrev: 'sq ft', tierLabel: 'Frequency' },
  'towing': { categoryLabel: 'Service Type', unitLabel: 'Distance', unitAbbrev: 'mi', tierLabel: 'Level' },
  'roofing': { categoryLabel: 'Service', unitLabel: 'Roof Size', unitAbbrev: 'sq ft', tierLabel: 'Material' },
  'electrical': { categoryLabel: 'Service', unitLabel: 'Outlets / Fixtures', unitAbbrev: 'qty', tierLabel: 'Package' },
  'pest-control': { categoryLabel: 'Service', unitLabel: 'Property Size', unitAbbrev: 'sq ft', tierLabel: 'Frequency' },
  'pressure-washing': { categoryLabel: 'Service', unitLabel: 'Surface Area', unitAbbrev: 'sq ft', tierLabel: 'Intensity' },
  'tree-service': { categoryLabel: 'Service', unitLabel: 'Trees', unitAbbrev: 'qty', tierLabel: 'Package' },
  'painting': { categoryLabel: 'Service', unitLabel: 'Walls / Area', unitAbbrev: 'sq ft', tierLabel: 'Finish' },
  'cleaning': { categoryLabel: 'Service', unitLabel: 'Rooms / Area', unitAbbrev: 'rooms', tierLabel: 'Frequency' },
  'handyman': { categoryLabel: 'Task', unitLabel: 'Estimated Hours', unitAbbrev: 'hrs', tierLabel: 'Complexity' },
  'flooring': { categoryLabel: 'Service', unitLabel: 'Floor Area', unitAbbrev: 'sq ft', tierLabel: 'Material' },
  'carpentry': { categoryLabel: 'Project', unitLabel: 'Size', unitAbbrev: 'ft', tierLabel: 'Quality' },
  'appliance-repair': { categoryLabel: 'Appliance Type', unitLabel: 'Appliances', unitAbbrev: 'qty', tierLabel: 'Package' },
  'locksmith': { categoryLabel: 'Service', unitLabel: 'Locks', unitAbbrev: 'qty', tierLabel: 'Complexity' },
  'moving': { categoryLabel: 'Move Type', unitLabel: 'Distance', unitAbbrev: 'mi', tierLabel: 'Service Level' },
  'mobile-auto': { categoryLabel: 'Service', unitLabel: 'Vehicles', unitAbbrev: 'qty', tierLabel: 'Package' },
  'junk-removal': { categoryLabel: 'Service', unitLabel: 'Volume', unitAbbrev: 'trucks', tierLabel: 'Package' },
  'concrete-masonry': { categoryLabel: 'Service', unitLabel: 'Area', unitAbbrev: 'sq ft', tierLabel: 'Material' },
  'pool-spa': { categoryLabel: 'Service', unitLabel: 'Pool Volume', unitAbbrev: 'gal', tierLabel: 'Frequency' },
  'garage-door': { categoryLabel: 'Service', unitLabel: 'Doors', unitAbbrev: 'qty', tierLabel: 'Package' },
  'gutters': { categoryLabel: 'Service', unitLabel: 'Length', unitAbbrev: 'ft', tierLabel: 'Material' },
  'chimney-fireplace': { categoryLabel: 'Service', unitLabel: 'Flues', unitAbbrev: 'qty', tierLabel: 'Package' },
  'home-inspection': { categoryLabel: 'Inspection Type', unitLabel: 'Property Size', unitAbbrev: 'sq ft', tierLabel: 'Package' },
  'security-systems': { categoryLabel: 'Service', unitLabel: 'Devices', unitAbbrev: 'qty', tierLabel: 'Package' },
  'irrigation': { categoryLabel: 'Service', unitLabel: 'Zones', unitAbbrev: 'zones', tierLabel: 'Package' },
  'solar': { categoryLabel: 'Service', unitLabel: 'System Size', unitAbbrev: 'kW', tierLabel: 'Efficiency' },
  'pet-services': { categoryLabel: 'Service', unitLabel: 'Pets', unitAbbrev: 'pets', tierLabel: 'Package' },
  'windows-doors': { categoryLabel: 'Service', unitLabel: 'Units', unitAbbrev: 'qty', tierLabel: 'Quality' },
  // Wave 3
  'insulation': { categoryLabel: 'Service', unitLabel: 'Area', unitAbbrev: 'sq ft', tierLabel: 'Package' },
  'drywall': { categoryLabel: 'Service', unitLabel: 'Sheets / Area', unitAbbrev: 'sq ft', tierLabel: 'Quality' },
  'waterproofing': { categoryLabel: 'Service', unitLabel: 'Area', unitAbbrev: 'sq ft', tierLabel: 'Package' },
  'foundation-repair': { categoryLabel: 'Service', unitLabel: 'Supports / Area', unitAbbrev: 'qty', tierLabel: 'Package' },
  'siding': { categoryLabel: 'Service', unitLabel: 'Area', unitAbbrev: 'sq ft', tierLabel: 'Material' },
  'fencing': { categoryLabel: 'Service', unitLabel: 'Length', unitAbbrev: 'ft', tierLabel: 'Material' },
  'snow-removal': { categoryLabel: 'Service', unitLabel: 'Area / Driveways', unitAbbrev: 'qty', tierLabel: 'Frequency' },
  'generator-services': { categoryLabel: 'Service', unitLabel: 'Generators', unitAbbrev: 'qty', tierLabel: 'Package' },
  'countertops': { categoryLabel: 'Service', unitLabel: 'Area', unitAbbrev: 'sq ft', tierLabel: 'Material' },
  'cabinet-painting': { categoryLabel: 'Service', unitLabel: 'Cabinets', unitAbbrev: 'qty', tierLabel: 'Finish' },
  'bathroom-remodel': { categoryLabel: 'Service', unitLabel: 'Bathrooms', unitAbbrev: 'qty', tierLabel: 'Package' },
  'kitchen-remodel': { categoryLabel: 'Service', unitLabel: 'Kitchens', unitAbbrev: 'qty', tierLabel: 'Package' },
  'epoxy-flooring': { categoryLabel: 'Service', unitLabel: 'Area', unitAbbrev: 'sq ft', tierLabel: 'Finish' },
  'outdoor-lighting': { categoryLabel: 'Service', unitLabel: 'Fixtures', unitAbbrev: 'qty', tierLabel: 'Package' },
  'deck-maintenance': { categoryLabel: 'Service', unitLabel: 'Area', unitAbbrev: 'sq ft', tierLabel: 'Package' },
  'septic-services': { categoryLabel: 'Service', unitLabel: 'Tanks / Jobs', unitAbbrev: 'qty', tierLabel: 'Package' },
  'well-services': { categoryLabel: 'Service', unitLabel: 'Wells', unitAbbrev: 'qty', tierLabel: 'Package' },
  'water-treatment': { categoryLabel: 'Service', unitLabel: 'Systems', unitAbbrev: 'qty', tierLabel: 'Package' },
  'glass-mirror': { categoryLabel: 'Service', unitLabel: 'Units', unitAbbrev: 'qty', tierLabel: 'Quality' },
  'blinds-shutters': { categoryLabel: 'Service', unitLabel: 'Windows', unitAbbrev: 'qty', tierLabel: 'Material' },
  'mold-remediation': { categoryLabel: 'Service', unitLabel: 'Area', unitAbbrev: 'sq ft', tierLabel: 'Package' },
  'fire-restoration': { categoryLabel: 'Service', unitLabel: 'Area', unitAbbrev: 'sq ft', tierLabel: 'Package' },
  'duct-cleaning': { categoryLabel: 'Service', unitLabel: 'Vents', unitAbbrev: 'qty', tierLabel: 'Package' },
  'tile-grout-cleaning': { categoryLabel: 'Service', unitLabel: 'Area', unitAbbrev: 'sq ft', tierLabel: 'Package' },
  'fire-protection': { categoryLabel: 'Service', unitLabel: 'Devices', unitAbbrev: 'qty', tierLabel: 'Package' },
  'commercial-refrigeration': { categoryLabel: 'Service', unitLabel: 'Units', unitAbbrev: 'qty', tierLabel: 'Package' },
  'restaurant-equipment': { categoryLabel: 'Service', unitLabel: 'Appliances', unitAbbrev: 'qty', tierLabel: 'Package' },
  'parking-lot': { categoryLabel: 'Service', unitLabel: 'Area / Stalls', unitAbbrev: 'qty', tierLabel: 'Package' },
  'signage-wraps': { categoryLabel: 'Service', unitLabel: 'Units', unitAbbrev: 'qty', tierLabel: 'Package' },
  'welding-fabrication': { categoryLabel: 'Service', unitLabel: 'Projects', unitAbbrev: 'qty', tierLabel: 'Package' },
  'elevator-services': { categoryLabel: 'Service', unitLabel: 'Elevators', unitAbbrev: 'qty', tierLabel: 'Package' },
  'mobile-notary': { categoryLabel: 'Service', unitLabel: 'Signings', unitAbbrev: 'qty', tierLabel: 'Package' },
  'personal-training': { categoryLabel: 'Service', unitLabel: 'Sessions', unitAbbrev: 'qty', tierLabel: 'Frequency' },
  'massage-therapy': { categoryLabel: 'Service', unitLabel: 'Duration', unitAbbrev: 'min', tierLabel: 'Type' },
  'tutoring': { categoryLabel: 'Subject', unitLabel: 'Hours', unitAbbrev: 'hrs', tierLabel: 'Package' },
  'catering-chef': { categoryLabel: 'Service', unitLabel: 'Guests', unitAbbrev: 'ppl', tierLabel: 'Package' },
  'photography-video': { categoryLabel: 'Service', unitLabel: 'Hours', unitAbbrev: 'hrs', tierLabel: 'Package' },
  'drone-services': { categoryLabel: 'Service', unitLabel: 'Flights', unitAbbrev: 'qty', tierLabel: 'Package' },
  'home-staging': { categoryLabel: 'Service', unitLabel: 'Rooms', unitAbbrev: 'rooms', tierLabel: 'Package' },
  'courier-delivery': { categoryLabel: 'Service', unitLabel: 'Deliveries', unitAbbrev: 'qty', tierLabel: 'Package' },
  'medical-transport': { categoryLabel: 'Service', unitLabel: 'Trips', unitAbbrev: 'qty', tierLabel: 'Package' },
  'limo-shuttle': { categoryLabel: 'Service', unitLabel: 'Hours / Distance', unitAbbrev: 'hrs', tierLabel: 'Package' },
  'hotshot-trucking': { categoryLabel: 'Service', unitLabel: 'Distance', unitAbbrev: 'mi', tierLabel: 'Package' },
  'rv-boat-service': { categoryLabel: 'Service', unitLabel: 'Length', unitAbbrev: 'ft', tierLabel: 'Package' },
  'event-rentals': { categoryLabel: 'Service', unitLabel: 'Items', unitAbbrev: 'qty', tierLabel: 'Package' },
  'dj-entertainment': { categoryLabel: 'Service', unitLabel: 'Hours', unitAbbrev: 'hrs', tierLabel: 'Package' },
  'bounce-house': { categoryLabel: 'Service', unitLabel: 'Units', unitAbbrev: 'qty', tierLabel: 'Duration' },
  'food-truck': { categoryLabel: 'Service', unitLabel: 'Hours / Guests', unitAbbrev: 'hrs', tierLabel: 'Package' },
  'it-computer-repair': { categoryLabel: 'Service', unitLabel: 'Devices', unitAbbrev: 'qty', tierLabel: 'Package' },
  'auto-body': { categoryLabel: 'Service', unitLabel: 'Panels', unitAbbrev: 'qty', tierLabel: 'Package' },
  // Fourth-wave industries
  'hotel-lodging': { categoryLabel: 'Room Type', unitLabel: 'Nights', unitAbbrev: 'nights', tierLabel: 'Room Class' },
  'restaurants-bars': { categoryLabel: 'Service', unitLabel: 'Guests', unitAbbrev: 'ppl', tierLabel: 'Package' },
  'tourism-travel': { categoryLabel: 'Package', unitLabel: 'Travelers', unitAbbrev: 'ppl', tierLabel: 'Package' },
  'event-planning': { categoryLabel: 'Service', unitLabel: 'Guests', unitAbbrev: 'ppl', tierLabel: 'Package' },
  'recreation-entertainment': { categoryLabel: 'Activity', unitLabel: 'Guests', unitAbbrev: 'ppl', tierLabel: 'Package' },
  'arts-culture': { categoryLabel: 'Admission', unitLabel: 'Tickets', unitAbbrev: 'qty', tierLabel: 'Package' },
  'legal-services': { categoryLabel: 'Service', unitLabel: 'Hours', unitAbbrev: 'hrs', tierLabel: 'Package' },
  'financial-professionals': { categoryLabel: 'Service', unitLabel: 'Hours', unitAbbrev: 'hrs', tierLabel: 'Package' },
  'business-consulting': { categoryLabel: 'Service', unitLabel: 'Hours', unitAbbrev: 'hrs', tierLabel: 'Package' },
  'marketing-advertising': { categoryLabel: 'Service', unitLabel: 'Hours', unitAbbrev: 'hrs', tierLabel: 'Package' },
  'it-services': { categoryLabel: 'Service', unitLabel: 'Hours', unitAbbrev: 'hrs', tierLabel: 'Package' },
  'architecture-engineering': { categoryLabel: 'Service', unitLabel: 'Project Scope', unitAbbrev: 'job', tierLabel: 'Package' },
  'research-services': { categoryLabel: 'Service', unitLabel: 'Hours', unitAbbrev: 'hrs', tierLabel: 'Package' },
  'beauty-salon': { categoryLabel: 'Service', unitLabel: 'Duration', unitAbbrev: 'min', tierLabel: 'Package' },
  'spa-wellness': { categoryLabel: 'Service', unitLabel: 'Duration', unitAbbrev: 'min', tierLabel: 'Package' },
  'fitness-studio': { categoryLabel: 'Service', unitLabel: 'Sessions', unitAbbrev: 'qty', tierLabel: 'Frequency' },
  'life-services': { categoryLabel: 'Service', unitLabel: 'Sessions', unitAbbrev: 'qty', tierLabel: 'Package' },
  'laundry-services': { categoryLabel: 'Service', unitLabel: 'Items', unitAbbrev: 'items', tierLabel: 'Turnaround' },
  'medical-clinic': { categoryLabel: 'Visit Type', unitLabel: 'Visits', unitAbbrev: 'qty', tierLabel: 'Package' },
  'therapy-rehab': { categoryLabel: 'Service', unitLabel: 'Sessions', unitAbbrev: 'qty', tierLabel: 'Package' },
  'senior-care': { categoryLabel: 'Care Type', unitLabel: 'Hours', unitAbbrev: 'hrs', tierLabel: 'Level' },
  'education-formal': { categoryLabel: 'Program', unitLabel: 'Credits', unitAbbrev: 'credits', tierLabel: 'Program Level' },
  'enrichment-education': { categoryLabel: 'Subject', unitLabel: 'Hours', unitAbbrev: 'hrs', tierLabel: 'Package' },
  'banking-lending': { categoryLabel: 'Service', unitLabel: 'Amount', unitAbbrev: '$', tierLabel: 'Product' },
  'investment-services': { categoryLabel: 'Service', unitLabel: 'Portfolio Size', unitAbbrev: '$', tierLabel: 'Tier' },
  'insurance-services': { categoryLabel: 'Policy Type', unitLabel: 'Coverage', unitAbbrev: '$', tierLabel: 'Plan' },
  'real-estate-services': { categoryLabel: 'Service', unitLabel: 'Properties', unitAbbrev: 'qty', tierLabel: 'Package' },
  'passenger-transport': { categoryLabel: 'Service', unitLabel: 'Distance', unitAbbrev: 'mi', tierLabel: 'Level' },
  'freight-logistics': { categoryLabel: 'Service', unitLabel: 'Weight', unitAbbrev: 'lbs', tierLabel: 'Package' },
  'waste-management': { categoryLabel: 'Service', unitLabel: 'Volume', unitAbbrev: 'yds', tierLabel: 'Frequency' },
}
