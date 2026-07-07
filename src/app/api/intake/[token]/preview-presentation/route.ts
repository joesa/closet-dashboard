import { NextResponse } from 'next/server'
import { resolveSitePresentationRules } from '@/lib/ai/resolveSitePresentation'
import { collectThemeLayoutPools, isLowConfidenceResolution } from '@/lib/catalog/serviceCatalog'
import { LAYOUT_SLUGS, THEME_SLUGS } from '@/lib/catalog/sitePresentationCatalog'
import { synthesizeThemeTokens } from '@/lib/ai/synthesizeThemeTokens'

export const runtime = 'nodejs'

/**
 * Rules-only (no AI) endpoint that resolves what theme + layout the system
 * would pick for the current form state. Used to power the pre-submit review
 * step. Theme/layout picking itself stays fast/deterministic, but when the
 * industry/services genuinely match nothing in the catalog, this also
 * synthesizes a bespoke "last resort" look via Gemini (see
 * isLowConfidenceResolution) so the review step previews exactly what will
 * be provisioned if the user keeps the suggested theme.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  // token param present for route consistency/future rate-limiting; not validated here
  await params

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    // empty body → use defaults
  }

  const toStr = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const toArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [])

  const services = toArr(body.services)
  const otherServices = toStr(body.otherServices)
  const industry = toStr(body.industry)
  const vibe = toStr(body.vibe)
  const primaryCta = toStr(body.primaryCta)
  const businessName = toStr(body.businessName)

  const result = resolveSitePresentationRules({
    industry,
    services: services.length > 0 ? services : undefined,
    other_services: otherServices,
    vibe,
    primary_cta: primaryCta,
  })

  // Collect industry-specific theme/layout pools
  const { themes: poolThemes, layouts: poolLayouts } = collectThemeLayoutPools({
    industry,
    services: services.length > 0 ? services : ['Walk-In Closets'],
    other_services: otherServices,
  })

  const allowedThemes = poolThemes.length >= 3 ? poolThemes : [...THEME_SLUGS]
  const allowedLayouts = poolLayouts.length >= 2 ? poolLayouts : [...LAYOUT_SLUGS]

  const lowConfidence = isLowConfidenceResolution({
    industry,
    services,
    other_services: otherServices,
  })

  let themeTokens
  if (lowConfidence) {
    const synthesized = await synthesizeThemeTokens(
      { industry, business_name: businessName, services, other_services: otherServices, vibe },
      { useGemini: true }
    )
    themeTokens = synthesized.tokens
  }

  return NextResponse.json({
    theme: result.theme,
    layoutStyle: result.layoutStyle,
    designVariantOverride: result.designVariantOverride,
    allowedThemes,
    allowedLayouts,
    themeTokens: themeTokens ?? null,
    isSynthesized: !!themeTokens,
  })
}

