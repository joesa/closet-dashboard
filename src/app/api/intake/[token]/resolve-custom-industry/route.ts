import { NextResponse } from 'next/server'
import { checkRateLimit, hashRateKey } from '@/lib/rateLimit'
import { isLowConfidenceResolution, resolveIndustrySlug, getIndustry } from '@/lib/catalog/serviceCatalog'
import {
  findCustomIndustryByLabel,
  createCustomIndustry,
} from '@/lib/catalog/customIndustries'
import { generateCustomIndustry } from '@/lib/ai/generateCustomIndustry'

export const maxDuration = 30
export const runtime = 'nodejs'

/**
 * Resolves whatever industry text a contractor typed (via the intake form's
 * "Other (enter custom industry)" option) to a real service suggestion list:
 *
 * 1. If it confidently matches an EXISTING catalog industry (just phrased
 *    differently), reuse that industry's services — no new industry created.
 * 2. Else, if a matching custom industry was already created by a previous
 *    contractor (same label), reuse its stored services/category — no
 *    duplicate Gemini call, no duplicate catalog entry.
 * 3. Else, generate a brand-new lightweight industry definition via Gemini
 *    (services, keywords, theme/layout pool, and a REQUIRED before/after
 *    image category) and persist it so future contractors can select this
 *    SAME industry from the dropdown instead of typing free text again.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const rate = await checkRateLimit(hashRateKey('resolve-custom-industry', token), 12, 10 * 60 * 1000)
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again shortly.' }, { status: 429 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    // empty body → validation below handles it
  }

  const industryText = typeof body.industry === 'string' ? body.industry.trim() : ''
  const businessName = typeof body.businessName === 'string' ? body.businessName.trim() : undefined
  const otherServices = typeof body.otherServices === 'string' ? body.otherServices.trim() : undefined

  if (!industryText) {
    return NextResponse.json({ error: 'industry is required' }, { status: 400 })
  }

  // 1. Confident match against the existing static catalog — reuse it.
  const lowConfidence = isLowConfidenceResolution({ industry: industryText })
  if (!lowConfidence) {
    const slug = resolveIndustrySlug({ industry: industryText })
    const industry = getIndustry(slug)
    return NextResponse.json({
      source: 'catalog',
      industrySlug: slug,
      label: industry.label,
      services: industry.services.map((s) => s.label),
    })
  }

  // 2. Already-created custom industry with the same label — reuse it.
  const existing = await findCustomIndustryByLabel(industryText)
  if (existing) {
    return NextResponse.json({
      source: 'custom-existing',
      industrySlug: existing.slug,
      label: existing.label,
      services: existing.services.map((s) => s.label),
    })
  }

  // 3. Genuinely new — generate + persist so it's selectable in the future.
  const generated = await generateCustomIndustry({
    industryText,
    businessName,
    otherServices,
  })

  try {
    const created = await createCustomIndustry({ ...generated.def, sourceIntakeId: undefined })
    return NextResponse.json({
      source: generated.source === 'gemini' ? 'custom-new' : 'custom-new-fallback',
      industrySlug: created.slug,
      label: created.label,
      services: created.services.map((s) => s.label),
    })
  } catch (error) {
    console.error('Failed to persist custom industry:', error)
    // Still return the generated services so this contractor isn't blocked,
    // even though it couldn't be saved for future reuse.
    return NextResponse.json({
      source: 'custom-new-unsaved',
      industrySlug: null,
      label: generated.def.label,
      services: generated.def.services.map((s) => s.label),
    })
  }
}
