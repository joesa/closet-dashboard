import { NextResponse } from 'next/server'
import { checkRateLimit, hashRateKey } from '@/lib/rateLimit'
import { resolveIndustryForSetup } from '@/lib/catalog/resolveIndustryForSetup'

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

  const result = await resolveIndustryForSetup({
    industryText,
    businessName,
    otherServices,
    sourceIntakeId: undefined,
  })

  return NextResponse.json({
    source: result.source,
    industrySlug: result.industrySlug,
    label: result.label,
    services: result.services,
    defaultThemes: result.defaultThemes,
    defaultLayouts: result.defaultLayouts,
    engagementModel: result.engagementModel,
    isCustom: result.isCustom,
  })
}
