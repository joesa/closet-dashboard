import {
  CTA_TO_LAYOUT,
  DEFAULT_LAYOUT,
  DEFAULT_THEME,
  type LayoutSlug,
  type ThemeSlug,
  VIBE_TO_THEME,
} from '@/lib/catalog/sitePresentationCatalog'
import {
  collectThemeLayoutPools,
  getEngagementModel,
  inferWidgetCategory,
  layoutsForTheme,
  matchServiceDef,
  pickBestLayout,
  pickBestTheme,
} from '@/lib/catalog/serviceCatalog'
import type { EngagementModel, IndustrySlug } from '@/lib/catalog/types'
import type { ThemeTokenSelection } from '@/lib/ai/synthesizeThemeTokens'
import type { BeforeAfterCategory } from '@/lib/openai-images'

export type SitePresentationInput = {
  industry?: string | null
  business_name?: string | null
  services?: string[] | null
  other_services?: string | null
  vibe?: string | null
  tone?: string | null
  customers?: string | null
  experience?: string | null
  primary_cta?: string | null
  differentiators?: string[] | null
  notes?: string | null
  service_area?: string | null
}

export type SitePresentationResult = {
  industry: IndustrySlug
  theme: ThemeSlug
  layoutStyle: LayoutSlug
  defaultRoom: string
  rationale: string
  source: 'rules' | 'gemini'
  engagementModel: EngagementModel
  themeTokens?: ThemeTokenSelection
  themeTokensSource?: 'gemini' | 'fallback'
  designVariantOverride?: string
  beforeAfterCategoryOverride?: BeforeAfterCategory
}

function primaryServiceLabel(services: string[]): string {
  const filtered = services.filter((service) => service && !service.startsWith('Other'))
  return filtered[0] || 'Walk-In Closets'
}

/** Browser-safe deterministic presentation from industry, services, vibe, and CTA. */
export function resolveSitePresentationRules(
  input: SitePresentationInput
): SitePresentationResult {
  const services =
    input.services?.length && input.services.length > 0
      ? input.services
      : ['Walk-In Closets']

  const { industry, themes, layouts } = collectThemeLayoutPools({
    services,
    other_services: input.other_services,
    industry: input.industry,
  })

  const seed = (input.business_name || input.service_area || '').trim() || null
  const bestTheme = pickBestTheme(themes, input.vibe, VIBE_TO_THEME, seed)
  const themeLayouts = layoutsForTheme(bestTheme, layouts)
  const bestLayout = pickBestLayout(
    themeLayouts,
    bestTheme,
    input.primary_cta,
    CTA_TO_LAYOUT,
    seed
  )

  const primary = primaryServiceLabel(services)
  const other = (input.other_services || '').trim()
  const hasCatalogService = services.some((service) =>
    Boolean(matchServiceDef(service, industry))
  )
  const matched = matchServiceDef(primary, industry) ?? matchServiceDef(primary)

  let defaultRoom =
    matched?.widgetCategory ?? inferWidgetCategory(services, input.other_services, industry)

  if (other && (!hasCatalogService || !matched)) {
    defaultRoom = inferWidgetCategory([], other, industry)
  }

  return {
    industry,
    theme: themes.includes(bestTheme) ? bestTheme : themes[0] ?? DEFAULT_THEME,
    layoutStyle: themeLayouts.includes(bestLayout)
      ? bestLayout
      : themeLayouts[0] ?? DEFAULT_LAYOUT,
    defaultRoom,
    rationale: `Rules: industry=${industry}, primary="${primary}", pools ${themes.length} themes / ${themeLayouts.length} layouts.`,
    source: 'rules',
    engagementModel: getEngagementModel(industry),
  }
}