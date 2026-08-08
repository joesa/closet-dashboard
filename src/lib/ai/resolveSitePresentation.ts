import {
  coerceLayoutSlug,
  coerceThemeSlug,
  CTA_TO_LAYOUT,
  type LayoutSlug,
  type ThemeSlug,
  VIBE_TO_THEME,
} from '@/lib/catalog/sitePresentationCatalog'
import {
  collectThemeLayoutPools,
  isLowConfidenceResolution,
  layoutsForTheme,
  pickBestLayout,
  pickBestTheme,
} from '@/lib/catalog/serviceCatalog'
import { buildIntakeBrief } from '@/lib/intake/buildIntakeBrief'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'
import { generateTextWithFallback } from '@/lib/ai/aiTextProvider'
import {
  synthesizeThemeTokens,
  type ThemeTokenSelection,
} from '@/lib/ai/synthesizeThemeTokens'
import { findCustomIndustryByLabel } from '@/lib/catalog/customIndustries'
import {
  resolveSitePresentationRules,
  type SitePresentationInput,
  type SitePresentationResult,
} from '@/lib/ai/sitePresentationRules'

export {
  resolveSitePresentationRules,
  type SitePresentationInput,
  type SitePresentationResult,
} from '@/lib/ai/sitePresentationRules'

export async function resolveSitePresentation(
  input: SitePresentationInput,
  opts?: { useGemini?: boolean }
): Promise<SitePresentationResult> {
  const rules = resolveSitePresentationRules(input)
  const useGemini = opts?.useGemini !== false && !!process.env.GEMINI_API_KEY

  // A contractor-created custom industry (see @/lib/catalog/customIndustries)
  // already carries a curated theme/layout pool + before/after category from
  // when it was generated — reuse it directly instead of re-running theme
  // synthesis/Gemini refinement on top of it. Only worth checking when the
  // static catalog genuinely has no confident match (the same signal that
  // gates last-resort theme-token synthesis below).
  const lowConfidence = isLowConfidenceResolution({
    industry: input.industry,
    services: input.services,
    other_services: input.other_services,
  })
  if (lowConfidence && input.industry?.trim()) {
    const customIndustry = await findCustomIndustryByLabel(input.industry)
    if (customIndustry) {
      const seed = (input.business_name || input.service_area || '').trim() || null
      const theme = pickBestTheme(customIndustry.defaultThemes, input.vibe, VIBE_TO_THEME, seed)
      const themeLayouts = layoutsForTheme(theme, customIndustry.defaultLayouts)
      const layoutStyle = pickBestLayout(
        themeLayouts.length > 0 ? themeLayouts : customIndustry.defaultLayouts,
        theme,
        input.primary_cta,
        CTA_TO_LAYOUT,
        seed
      )
      return {
        ...rules,
        theme,
        layoutStyle,
        rationale: `Custom industry "${customIndustry.label}" (${customIndustry.slug}): pool ${customIndustry.defaultThemes.length} themes / ${customIndustry.defaultLayouts.length} layouts.`,
        source: 'rules',
        beforeAfterCategoryOverride: customIndustry.beforeAfterCategory,
        engagementModel: customIndustry.engagementModel,
      }
    }
  }

  // Last-resort theme synthesis — only when the industry/services genuinely
  // matched nothing in the catalog (not just when the theme pool happens to
  // be the generic top-8 fallback, since industry.defaultThemes covers most
  // real industries already).
  let themeTokens: ThemeTokenSelection | undefined
  let themeTokensSource: 'gemini' | 'fallback' | undefined
  if (lowConfidence) {
    const synthesized = await synthesizeThemeTokens(
      {
        industry: input.industry,
        business_name: input.business_name,
        services: input.services,
        other_services: input.other_services,
        vibe: input.vibe,
        tone: input.tone,
        differentiators: input.differentiators,
      },
      { useGemini }
    )
    themeTokens = synthesized.tokens
    themeTokensSource = synthesized.source
  }

  if (!useGemini) return { ...rules, themeTokens, themeTokensSource }

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
  const prompt = `Pick the best marketing site theme and page layout for this contractor business.
Return JSON only: { "theme": string, "layoutStyle": string, "defaultRoom": string, "isCinematicHero": boolean, "rationale": string }
Industry context: ${industry}
theme MUST be one of: ${themes.join(', ')}
layoutStyle MUST be one of: ${themeLayouts.join(', ')}
defaultRoom should be a short primary service/category label for the quote widget.
isCinematicHero should be true ONLY if the business relies heavily on high-end visual showcase (e.g. luxury remodels, landscaping, architecture, events) where a full-screen background image is the best way to sell the service.

Business brief:
${brief}
${input.other_services?.trim() ? `\nCustom services (Other): ${input.other_services.trim()}` : ''}

Rules suggestion (use unless clearly wrong): theme=${rules.theme}, layout=${rules.layoutStyle}, room=${rules.defaultRoom}`

  try {
    const { text: raw, provider } = await generateTextWithFallback({
      prompt,
      jsonMode: true,
      temperature: 0.4,
      maxOutputTokens: 1024,
    })
    const parsed = JSON.parse(raw) as {
      theme?: string
      layoutStyle?: string
      defaultRoom?: string
      isCinematicHero?: boolean
      rationale?: string
    }
    const theme = coerceThemeSlug(
      themes.includes(parsed.theme as ThemeSlug) ? parsed.theme : rules.theme
    )
    // Recompute the valid layout pool from the FULL layouts pool for
    // whichever theme was actually chosen above (not from `themeLayouts`,
    // which was narrowed for `rules.theme` — if Gemini picked a DIFFERENT
    // theme than the rules suggestion, narrowing from that stale subset
    // could produce a layout that doesn't actually pair with the final
    // theme's affinity, e.g. theme="gourmet-warm" + layoutStyle="visual-impact"
    // even though "visual-impact" isn't in gourmet-warm's affinity list).
    const narrowedLayouts = layoutsForTheme(theme, layouts)
    const layoutStyle = coerceLayoutSlug(
      narrowedLayouts.includes(parsed.layoutStyle as LayoutSlug)
        ? parsed.layoutStyle
        // Only reuse the rules layout if it's actually valid for the FINAL
        // theme; otherwise pick the top affinity-ranked layout for that
        // theme instead of a mismatched one carried over from a different
        // theme's suggestion.
        : narrowedLayouts.includes(rules.layoutStyle)
          ? rules.layoutStyle
          : narrowedLayouts[0]
    )
    return {
      industry,
      theme,
      layoutStyle,
      defaultRoom: parsed.defaultRoom?.trim() || rules.defaultRoom,
      rationale: parsed.rationale
        ? `Gemini: ${parsed.rationale}`
        : `Gemini resolved theme=${theme}, layout=${layoutStyle}, room=${parsed.defaultRoom || rules.defaultRoom}`,
      source: 'gemini',
      themeTokens,
      themeTokensSource,
      engagementModel: rules.engagementModel,
      // NOTE: we intentionally do NOT force a fixed preset (previously 'atelier')
      // for visually-driven businesses. Pinning every "cinematic" trade to one
      // named studio made all of them (tree services, landscapers, remodelers)
      // render with identical structure. The per-site seeded resolver
      // (resolveDesignSeed in provisionTenant) already guarantees a unique,
      // non-duplicate composition per site, and the theme archetype weighting
      // in designVariants.ts already biases bold/luxe themes toward cinematic
      // heroes — so variety is preserved without cookie-cutter collisions.
    }
  } catch {
    return { ...rules, themeTokens, themeTokensSource }
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
