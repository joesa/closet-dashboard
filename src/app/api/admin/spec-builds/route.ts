import { NextResponse } from 'next/server'
import { getCurrentAdmin, logAdminAction } from '@/lib/admin'
import { queueSpecBuild } from '@/lib/spec/specBuilds'
import { kickSpecBuild } from '@/lib/spec/kickSpecBuild'
import type { SpecBuildLeadInput } from '@/lib/spec/types'

export const runtime = 'nodejs'

/** One row of the bulk form. Everything but name and phone is optional. */
type ManualLeadBody = {
  businessName?: string
  phone?: string
  services?: string | string[]
  city?: string
  email?: string
  socialProfileUrl?: string
  yelpUrl?: string
}

export type QueueLeadOutcome = {
  businessName: string
  phone: string
  status: 'queued' | 'duplicate' | 'invalid_phone' | 'missing_name' | 'error'
  id?: string
  message?: string
}

function toServices(raw: ManualLeadBody['services']): string[] {
  if (Array.isArray(raw)) return raw.map((s) => s.trim()).filter(Boolean)
  if (typeof raw !== 'string') return []
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Admin-only: queue one or many hand-found leads (the yard-sign case).
 *
 * Note `/api/admin/*` is not covered by the proxy matcher in src/proxy.ts —
 * every admin API route guards itself, and this one is no exception.
 *
 * Each row is queued independently and reported on independently: a duplicate
 * phone number in row 3 must not discard the eight good rows around it, which
 * is exactly what someone pasting a list of leads would lose.
 */
export async function POST(req: Request) {
  const admin = await getCurrentAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as { leads?: ManualLeadBody[] }
  const rows = Array.isArray(body.leads) ? body.leads : []
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Provide at least one lead.' }, { status: 400 })
  }
  if (rows.length > 50) {
    return NextResponse.json({ error: 'Submit at most 50 leads at a time.' }, { status: 400 })
  }

  const results: QueueLeadOutcome[] = []
  for (const row of rows) {
    const businessName = (row.businessName || '').trim()
    const phone = (row.phone || '').trim()
    if (!businessName && !phone) continue // an untouched blank row in the form

    const lead: SpecBuildLeadInput = {
      businessName,
      phone,
      services: toServices(row.services),
      city: row.city?.trim() || null,
      email: row.email?.trim() || null,
      socialProfileUrl: row.socialProfileUrl?.trim() || null,
      yelpUrl: row.yelpUrl?.trim() || null,
    }

    try {
      const result = await queueSpecBuild({ lead, leadSource: 'manual' })
      if (result.queued) {
        // Typing a lead in is an explicit instruction to build it, so it runs
        // without further clicks. The scraper path is the one that stays behind
        // SPEC_BUILD_ENABLED, because that is the one that could queue dozens.
        kickSpecBuild(result.id)
        results.push({ businessName, phone, status: 'queued', id: result.id })
      } else {
        results.push({
          businessName,
          phone,
          status: result.reason,
          message:
            result.reason === 'duplicate'
              ? 'Already queued — there is a live spec build for this number.'
              : result.reason === 'invalid_phone'
                ? 'Could not read that as a phone number.'
                : 'Business name is required.',
        })
      }
    } catch (err) {
      results.push({
        businessName,
        phone,
        status: 'error',
        message: err instanceof Error ? err.message : 'Failed to queue.',
      })
    }
  }

  const queued = results.filter((r) => r.status === 'queued')
  if (queued.length > 0) {
    await logAdminAction({
      actor: admin,
      action: 'spec_build.queued_manual',
      targetType: 'spec_build',
      targetId: queued[0].id,
      metadata: { count: queued.length, ids: queued.map((r) => r.id) },
    })
  }

  return NextResponse.json({ results, queuedCount: queued.length })
}
