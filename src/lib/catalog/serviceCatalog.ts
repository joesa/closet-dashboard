import {
  ALL_SERVICES,
  INDUSTRIES,
  INDUSTRY_BY_SLUG,
} from '@/lib/catalog/industries/index'
import type { IndustryDef, IndustrySlug, ServiceDef } from '@/lib/catalog/types'
import {
  DEFAULT_LAYOUT,
  DEFAULT_THEME,
  type LayoutSlug,
  LAYOUT_SLUGS,
  type ThemeSlug,
  THEME_LAYOUT_AFFINITY,
  THEME_SLUGS,
} from '@/lib/catalog/sitePresentationCatalog'

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
      if (normalizeCatalogText(ind.label) === industryText) score += 20
      if (industryText.includes(normalizeCatalogText(ind.slug))) score += 8
      for (const kw of ind.keywords) {
        const k = normalizeCatalogText(kw)
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

export function pickBestTheme(
  themes: ThemeSlug[],
  vibe?: string | null,
  vibeMap?: Record<string, ThemeSlug>
): ThemeSlug {
  let best = DEFAULT_THEME
  let bestScore = -1
  for (const t of themes) {
    let score = 10
    if (vibe && vibeMap?.[vibe] === t) score += 5
    if (score > bestScore) {
      bestScore = score
      best = t
    }
  }
  if (vibe && vibeMap?.[vibe] && themes.includes(vibeMap[vibe])) {
    return vibeMap[vibe]
  }
  return themes.includes(best) ? best : themes[0] ?? DEFAULT_THEME
}

export function pickBestLayout(
  layouts: LayoutSlug[],
  theme: ThemeSlug,
  cta?: string | null,
  ctaMap?: Record<string, LayoutSlug>
): LayoutSlug {
  const themeLayouts = layoutsForTheme(theme, layouts)
  let best = DEFAULT_LAYOUT
  let bestScore = -1
  for (const l of themeLayouts) {
    let score = 10
    if (cta && ctaMap?.[cta] === l) score += 5
    if (score > bestScore) {
      bestScore = score
      best = l
    }
  }
  if (cta && ctaMap?.[cta] && themeLayouts.includes(ctaMap[cta])) {
    return ctaMap[cta]
  }
  return themeLayouts.includes(best) ? best : themeLayouts[0] ?? DEFAULT_LAYOUT
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
