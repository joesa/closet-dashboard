import {
  coerceLayoutSlug,
  coerceThemeSlug,
  CTA_TO_LAYOUT,
  DEFAULT_LAYOUT,
  DEFAULT_THEME,
  type LayoutSlug,
  type ThemeSlug,
  VIBE_TO_THEME,
} from '@/lib/catalog/sitePresentationCatalog'
import {
  collectThemeLayoutPools,
  inferWidgetCategory,
  layoutsForTheme,
  matchServiceDef,
  pickBestLayout,
  pickBestTheme,
} from '@/lib/catalog/serviceCatalog'
import type { IndustrySlug } from '@/lib/catalog/types'
import { buildIntakeBrief } from '@/lib/intake/buildIntakeBrief'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'
import { GoogleGenerativeAI, type GenerationConfig } from '@google/generative-ai'

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
}

function primaryServiceLabel(services: string[]): string {
  const filtered = services.filter((s) => s && !s.startsWith('Other'))
  return filtered[0] || 'Walk-In Closets'
}

/** Deterministic presentation from industry, services, vibe, and CTA. */
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

  const bestTheme = pickBestTheme(themes, input.vibe, VIBE_TO_THEME)
  const themeLayouts = layoutsForTheme(bestTheme, layouts)
  const bestLayout = pickBestLayout(themeLayouts, bestTheme, input.primary_cta, CTA_TO_LAYOUT)

  const primary = primaryServiceLabel(services)
  const other = (input.other_services || '').trim()
  const hasCatalogService = services.some((s) => !!matchServiceDef(s, industry))
  const matched = matchServiceDef(primary, industry) ?? matchServiceDef(primary)

  let defaultRoom =
    matched?.widgetCategory ?? inferWidgetCategory(services, input.other_services, industry)

  if (other && (!hasCatalogService || !matched)) {
    defaultRoom = inferWidgetCategory([], other, industry)
  }

  return {
    industry,
    theme: themes.includes(bestTheme) ? bestTheme : themes[0] ?? DEFAULT_THEME,
    layoutStyle: themeLayouts.includes(bestLayout) ? bestLayout : themeLayouts[0] ?? DEFAULT_LAYOUT,
    defaultRoom,
    rationale: `Rules: industry=${industry}, primary="${primary}", pools ${themes.length} themes / ${themeLayouts.length} layouts.`,
    source: 'rules',
  }
}

export async function resolveSitePresentation(
  input: SitePresentationInput,
  opts?: { useGemini?: boolean }
): Promise<SitePresentationResult> {
  const rules = resolveSitePresentationRules(input)
  const useGemini = opts?.useGemini !== false && !!process.env.GEMINI_API_KEY

  if (!useGemini) return rules

  const services =
    input.services?.length && input.services.length > 0
      ? input.services
      : ['Walk-In Closets']

  const { industry, themes, layouts } = collectThemeLayoutPools({
    services,
    other_services: input.other_services,
    industry: input.industry,
  })
  const themeLayouts = layoutsForTheme(rules.theme, layouts)

  const brief = buildIntakeBrief(input as ProspectIntakeRow)
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.4,
      maxOutputTokens: 1024,
    } as GenerationConfig,
  })

  const prompt = `Pick the best marketing site theme and page layout for this contractor business.
Return JSON only: { "theme": string, "layoutStyle": string, "defaultRoom": string, "rationale": string }
Industry context: ${industry}
theme MUST be one of: ${themes.join(', ')}
layoutStyle MUST be one of: ${themeLayouts.join(', ')}
defaultRoom should be a short primary service/category label for the quote widget.

Business brief:
${brief}
${input.other_services?.trim() ? `\nCustom services (Other): ${input.other_services.trim()}` : ''}

Rules suggestion (use unless clearly wrong): theme=${rules.theme}, layout=${rules.layoutStyle}, room=${rules.defaultRoom}`

  try {
    const result = await model.generateContent(prompt)
    const raw = result.response.text()
    const parsed = JSON.parse(raw) as {
      theme?: string
      layoutStyle?: string
      defaultRoom?: string
      rationale?: string
    }
    const theme = coerceThemeSlug(
      themes.includes(parsed.theme as ThemeSlug) ? parsed.theme : rules.theme
    )
    const narrowedLayouts = layoutsForTheme(theme, themeLayouts)
    const layoutStyle = coerceLayoutSlug(
      narrowedLayouts.includes(parsed.layoutStyle as LayoutSlug)
        ? parsed.layoutStyle
        : rules.layoutStyle
    )
    return {
      industry,
      theme,
      layoutStyle,
      defaultRoom: parsed.defaultRoom?.trim() || rules.defaultRoom,
      rationale: parsed.rationale?.trim() || rules.rationale,
      source: 'gemini',
    }
  } catch {
    return rules
  }
}

export function presentationFromIntakeRow(row: ProspectIntakeRow): SitePresentationInput {
  return {
    industry: row.industry,
    business_name: row.business_name,
    services: row.services,
    other_services: row.other_services,
    vibe: row.vibe,
    tone: row.tone,
    customers: row.customers,
    experience: row.experience,
    primary_cta: row.primary_cta,
    differentiators: row.differentiators,
    notes: row.notes,
    service_area: row.service_area,
  }
}
