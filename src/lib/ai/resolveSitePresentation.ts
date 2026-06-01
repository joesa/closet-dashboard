import { GoogleGenerativeAI, type GenerationConfig } from '@google/generative-ai'
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
  getServiceDef,
  widgetRoomForService,
} from '@/lib/catalog/contractorServices'
import type { RoomType } from '@/lib/rooms'
import { buildIntakeBrief } from '@/lib/intake/buildIntakeBrief'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'

export type SitePresentationInput = {
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

function scoreTheme(theme: ThemeSlug, pools: ThemeSlug[], vibe?: string | null): number {
  let score = pools.includes(theme) ? 10 : 0
  if (vibe && VIBE_TO_THEME[vibe] === theme) score += 5
  return score
}

function scoreLayout(layout: LayoutSlug, pools: LayoutSlug[], cta?: string | null): number {
  let score = pools.includes(layout) ? 10 : 0
  if (cta && CTA_TO_LAYOUT[cta] === layout) score += 5
  return score
}

/** Deterministic presentation from services, vibe, and CTA. */
export function resolveSitePresentationRules(
  input: SitePresentationInput
): SitePresentationResult {
  const services =
    input.services?.length && input.services.length > 0
      ? input.services
      : ['Walk-In Closets']

  const { themes, layouts } = collectThemeLayoutPools(services, input.other_services)

  let bestTheme = DEFAULT_THEME
  let bestThemeScore = -1
  for (const t of themes) {
    const s = scoreTheme(t, themes, input.vibe)
    if (s > bestThemeScore) {
      bestThemeScore = s
      bestTheme = t
    }
  }
  if (input.vibe && VIBE_TO_THEME[input.vibe]) {
    const vibeTheme = VIBE_TO_THEME[input.vibe]
    if (themes.includes(vibeTheme)) bestTheme = vibeTheme
  }

  let bestLayout = DEFAULT_LAYOUT
  let bestLayoutScore = -1
  for (const l of layouts) {
    const s = scoreLayout(l, layouts, input.primary_cta)
    if (s > bestLayoutScore) {
      bestLayoutScore = s
      bestLayout = l
    }
  }
  if (input.primary_cta && CTA_TO_LAYOUT[input.primary_cta]) {
    const ctaLayout = CTA_TO_LAYOUT[input.primary_cta]
    if (layouts.includes(ctaLayout)) bestLayout = ctaLayout
  }

  const primary = primaryServiceLabel(services)
  let defaultRoom = widgetRoomForService(primary)
  const other = (input.other_services || '').trim()
  const hasCatalogService = services.some((s) => !!getServiceDef(s))
  if (other && !hasCatalogService) {
    defaultRoom = inferRoomFromOtherText(other)
  } else if (other && !getServiceDef(primary)) {
    defaultRoom = inferRoomFromOtherText(other)
  }

  return {
    theme: bestTheme,
    layoutStyle: bestLayout,
    defaultRoom,
    rationale: `Rules: primary service "${primary}", pools ${themes.length} themes / ${layouts.length} layouts.`,
    source: 'rules',
  }
}

function inferRoomFromOtherText(text: string): RoomType {
  const t = text.toLowerCase()
  if (t.includes('wine') || t.includes('cellar')) return 'Pantry & Wine'
  if (t.includes('garage')) return 'Garage'
  if (t.includes('mudroom') || t.includes('entry')) return 'Mudroom'
  if (t.includes('office') || t.includes('desk')) return 'Home Office'
  if (t.includes('laundry')) return 'Laundry Room'
  if (t.includes('craft') || t.includes('sewing')) return 'Craft Room'
  if (t.includes('media') || t.includes('entertainment')) return 'Entertainment Center'
  if (t.includes('kid')) return 'Kid Spaces'
  return 'Walk-In Closet'
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
  const { themes, layouts } = collectThemeLayoutPools(services, input.other_services)

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

  const prompt = `Pick the best marketing site theme and page layout for this custom storage / closet business.
Return JSON only: { "theme": string, "layoutStyle": string, "defaultRoom": string, "rationale": string }
theme MUST be one of: ${themes.join(', ')}
layoutStyle MUST be one of: ${layouts.join(', ')}
defaultRoom should be a short room type label for the quote widget primary room.

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
    const layoutStyle = coerceLayoutSlug(
      layouts.includes(parsed.layoutStyle as LayoutSlug)
        ? parsed.layoutStyle
        : rules.layoutStyle
    )
    return {
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
