import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { generateSiteConfigFromInput } from '@/lib/ai/generateSiteConfig'
import { mergeAiSiteConfigWithPresentation } from '@/lib/ai/mergeAiSitePresentation'
import { buildIntakeBrief } from '@/lib/intake/buildIntakeBrief'
import { getIntakeByToken } from '@/lib/intake/getIntakeByToken'
import { assertDraftIntake, assertDepositPaid } from '@/lib/intake/intakeTierGates'
import { checkRateLimit, hashRateKey } from '@/lib/rateLimit'
import { clampPagesForTier, pageSlugsToSitemap } from '@/lib/catalog/sitePages'

export const maxDuration = 60
export const runtime = 'nodejs'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const row = await getIntakeByToken(token)
    if (!row) {
      return NextResponse.json({ error: 'Intake not found' }, { status: 404 })
    }

    const draftErr = assertDraftIntake(row)
    if (draftErr) {
      return NextResponse.json({ error: draftErr }, { status: 410 })
    }

    const depositErr = assertDepositPaid(row)
    if (depositErr) {
      return NextResponse.json({ error: depositErr }, { status: 403 })
    }

    const limit = await checkRateLimit(hashRateKey('intake_ai_site', token), 3, 24 * 60 * 60 * 1000)
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many AI brief generations today.' }, { status: 429 })
    }

    const brief = buildIntakeBrief(row)
    if (!brief.trim()) {
      return NextResponse.json(
        { error: 'Fill in business details before generating the AI brief.' },
        { status: 400 }
      )
    }

    // Prefer pages selected in the live form; fall back to what's already
    // saved. Either way, enforce the tier's page cap so the AI never builds
    // more pages than the customer's plan allows.
    const tier = row.intake_tier === 'ai_premium' ? 'ai_premium' : 'standard'
    let pageSlugs: string[] = []
    try {
      const body = await req.json()
      pageSlugs = clampPagesForTier(body?.pages, tier)
    } catch {
      // No/invalid body — fall back to persisted selection below.
    }
    if (pageSlugs.length === 0) {
      pageSlugs = clampPagesForTier(row.requested_pages, tier)
    }
    const sitemap = pageSlugsToSitemap(pageSlugs)

    const result = await generateSiteConfigFromInput(brief, sitemap)
    const merged = await mergeAiSiteConfigWithPresentation(row, result.data)
    const admin = getSupabaseAdmin()
    await admin
      .from('prospect_intakes')
      .update({
        ai_site_config: merged,
        requested_pages: pageSlugs,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)

    return NextResponse.json({
      success: true,
      source: result.source,
      data: merged,
    })
  } catch (error) {
    console.error('intake generate-site error:', error)
    const message = error instanceof Error ? error.message : 'Generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
