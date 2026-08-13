import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { buildIntakeBrief, stripUneditedCraftSuggestions } from '@/lib/intake/buildIntakeBrief'
import { getIntakeByToken } from '@/lib/intake/getIntakeByToken'
import { assertDraftIntake, assertDepositPaid } from '@/lib/intake/intakeTierGates'
import { checkRateLimit, hashRateKey } from '@/lib/rateLimit'
import { clampPagesForTier, SITE_PAGE_SLUGS } from '@/lib/catalog/sitePages'
import { OTHER_SERVICE_LABEL } from '@/lib/catalog/contractorServices'
import { canEnqueueBackgroundJobs, enqueueJob } from '@/lib/jobs/enqueueJob'
import { TASK_INTAKE_GENERATE_SITE } from '@/lib/jobs/taskIds'

export const maxDuration = 120
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

    // Client used to auto-retry on failure and burn this quickly; keep a
    // generous daily cap for legitimate regenerations after edits.
    const limit = await checkRateLimit(hashRateKey('intake_ai_site', token), 12, 24 * 60 * 60 * 1000)
    if (!limit.allowed) {
      return NextResponse.json({ error: 'Too many AI brief generations today.' }, { status: 429 })
    }

    // Prefer pages selected in the live form; fall back to what's already
    // saved. Either way, enforce the tier's page cap so the AI never builds
    // more pages than the customer's plan allows.
    let body: Record<string, unknown> = {}
    try {
      body = await req.json()
    } catch {
      // Empty body
    }

    const tier = row.intake_tier === 'ai_premium' ? 'ai_premium' : 'standard'
    let pageSlugs = clampPagesForTier(body?.pages, tier)
    if (pageSlugs.length === 0) {
      pageSlugs = clampPagesForTier(row.requested_pages, tier)
    }

    // Update draft fields in database so the generated brief is based on the user's latest inputs
    const toStr = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
    const toArr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [])

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (body.businessName !== undefined) update.business_name = toStr(body.businessName)
    if (body.industry !== undefined) update.industry = toStr(body.industry)
    if (body.contactName !== undefined) update.contact_name = toStr(body.contactName)
    if (body.contactEmail !== undefined) update.contact_email = toStr(body.contactEmail)
    if (body.contactPhone !== undefined) update.contact_phone = toStr(body.contactPhone)
    if (body.streetAddress !== undefined) update.street_address = toStr(body.streetAddress)
    if (body.addressLocality !== undefined) update.address_locality = toStr(body.addressLocality)
    if (body.addressRegion !== undefined) update.address_region = toStr(body.addressRegion)
    if (body.postalCode !== undefined) update.postal_code = toStr(body.postalCode)
    if (body.serviceArea !== undefined) update.service_area = toStr(body.serviceArea)
    if (body.notificationEmail !== undefined) update.notification_email = toStr(body.notificationEmail)
    if (body.notificationPhone !== undefined) update.notification_phone = toStr(body.notificationPhone)
    
    if (body.services !== undefined) {
      const services = toArr(body.services)
      update.services = services
      if (body.otherServices !== undefined) {
        const hasOther = services.includes(OTHER_SERVICE_LABEL)
        update.other_services = hasOther ? toStr(body.otherServices) : null
      }
    }
    
    if (body.pricingNotes !== undefined) update.pricing_notes = toStr(body.pricingNotes)
    if (body.primaryColorHex !== undefined) update.primary_color_hex = toStr(body.primaryColorHex)
    if (body.vibe !== undefined) update.vibe = toStr(body.vibe)
    if (body.tone !== undefined) update.tone = toStr(body.tone)
    if (body.customers !== undefined) update.customers = toStr(body.customers)
    if (body.experience !== undefined) update.experience = toStr(body.experience)
    if (body.differentiators !== undefined) update.differentiators = toArr(body.differentiators)
    if (body.primaryCta !== undefined) update.primary_cta = toStr(body.primaryCta)
    if (body.desiredDomain !== undefined) update.desired_domain = toStr(body.desiredDomain)
    if (body.domainPurchaseRequested !== undefined) {
      update.domain_purchase_requested = body.domainPurchaseRequested === true
    }
    if (body.includeQuiz !== undefined) {
      update.include_quiz = body.includeQuiz === true
    }
    if (body.notes !== undefined) update.notes = toStr(body.notes)
    if (body.customerQuotes !== undefined) update.customer_quotes = toStr(body.customerQuotes)
    
    if (body.pages !== undefined) {
      update.requested_pages = pageSlugs
    }

    // Merge in freshly-typed page content from the live form (the "Customize
    // Page Content" section) so the AI brief/image prompts can draw on it as
    // extra context, even if the user hasn't submitted the intake yet. Only
    // known page slugs with non-empty text are kept; existing DB content for
    // pages not present in the submitted body is preserved.
    let effectivePageContents = row.page_contents as Record<string, string> | null
    if (body.pageContents && typeof body.pageContents === 'object' && !Array.isArray(body.pageContents)) {
      // Standard catalog pages + AI-suggested / custom pages the prospect chose.
      const validSlugs = new Set([...SITE_PAGE_SLUGS, ...pageSlugs])
      const sanitized: Record<string, string> = {}
      for (const [slug, raw] of Object.entries(body.pageContents)) {
        if (!validSlugs.has(slug)) continue
        if (typeof raw !== 'string') continue
        const text = raw.trim()
        if (!text) continue
        sanitized[slug] = text.split(/\s+/).filter(Boolean).slice(0, 1200).join(' ')
      }
      if (Object.keys(sanitized).length > 0) {
        effectivePageContents = { ...(row.page_contents || {}), ...sanitized }
        update.page_contents = effectivePageContents
      }
    }

    if (Object.keys(update).length > 1) {
      const admin = getSupabaseAdmin()
      const { error: updateErr } = await admin
        .from('prospect_intakes')
        .update(update)
        .eq('id', row.id)
      
      if (updateErr) {
        console.error('Error updating draft intake in generate-site:', updateErr)
      } else {
        Object.assign(row, update)
      }
    }

    // Unedited AI craft suggestions are examples, not proof — keep them out
    // of the brief the site is generated from.
    stripUneditedCraftSuggestions(row as Record<string, unknown>, body.craftSuggestedFields)

    const brief = buildIntakeBrief(row)
    if (!brief.trim()) {
      return NextResponse.json(
        { error: 'Fill in business details before generating the AI brief.' },
        { status: 400 }
      )
    }

    // Intake generation is Oracle-only. Never fall back to a long-running
    // Vercel request when the worker queue is unavailable.
    if (!canEnqueueBackgroundJobs()) {
      return NextResponse.json(
        { error: 'Background generation is temporarily unavailable.' },
        { status: 503 }
      )
    }
    {
      const admin = getSupabaseAdmin()
      await admin
        .from('prospect_intakes')
        .update({
          requested_pages: pageSlugs,
          ...(effectivePageContents ? { page_contents: effectivePageContents } : {}),
          background_job: {
            task: 'intake_generate_site',
            status: 'queued',
            started_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)

      await enqueueJob(
        TASK_INTAKE_GENERATE_SITE,
        {
          token,
          pageSlugs,
          pageContents: effectivePageContents || undefined,
        },
        {
          jobKey: `intake_generate_site:${token}`,
          jobKeyMode: 'replace',
          // Two automatic retries with backoff before going terminal — the
          // studio client can still re-enqueue a terminally failed job.
          maxAttempts: 3,
        }
      )

      return NextResponse.json({
        async: true,
        success: true,
        reply: 'AI brief queued on the background worker — this page will update when ready.',
      })
    }

  } catch (error) {
    console.error('intake generate-site error:', error)
    const message = error instanceof Error ? error.message : 'Generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
