import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { sendLeadDigest, type DigestLead } from '@/lib/email/leadDigest'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * The weekly lead summary, one message per contractor.
 *
 * Runs on Monday. Contractors with no leads are included deliberately — a
 * quiet week is the week they most need to hear from us, and only mailing the
 * happy cases would make the product look better than it is.
 *
 * Reads with the service role because it deliberately crosses every tenant;
 * each send is scoped to one contractor's own rows, and the idempotency key
 * carries the contractor id so a retry cannot cross-deliver.
 */

/** ISO week identifier, e.g. 2026-W34. Stable across retries within the week. */
export function isoWeekKey(date: Date): string {
  // Thursday of the same week determines the ISO year.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Human label for the week that just ended, e.g. "12–18 August". */
export function weekLabel(from: Date, to: Date): string {
  const month = (d: Date) => d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
  const sameMonth = from.getUTCMonth() === to.getUTCMonth()
  return sameMonth
    ? `${from.getUTCDate()}–${to.getUTCDate()} ${month(to)}`
    : `${from.getUTCDate()} ${month(from)} – ${to.getUTCDate()} ${month(to)}`
}

/** Statuses whose owners should still hear from us. */
const MAILABLE_STATUSES = new Set(['active', 'trialing', 'past_due', 'comp'])

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')?.trim()
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const admin = getSupabaseAdmin()
  const now = new Date()
  const since = new Date(now.getTime() - 7 * 86_400_000)
  const weekKey = isoWeekKey(since)
  const label = weekLabel(since, new Date(now.getTime() - 86_400_000))

  const { data: contractors, error } = await admin
    .from('contractor_settings')
    .select('id, contact_email, company_name, subscription_status')
    .limit(2000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // One query for the whole week rather than one per contractor: at a few
  // hundred tenants the per-tenant version is a few hundred round trips.
  const { data: leadRows, error: leadsError } = await admin
    .from('leads')
    .select('contractor_id, first_name, last_name, email, estimated_total, created_at, duplicate_of')
    .gte('created_at', since.toISOString())
    .limit(20000)

  if (leadsError) return NextResponse.json({ error: leadsError.message }, { status: 500 })

  const byContractor = new Map<string, DigestLead[]>()
  for (const row of leadRows ?? []) {
    const id = (row as { contractor_id: string }).contractor_id
    if (!id) continue
    const list = byContractor.get(id) ?? []
    list.push(row as DigestLead)
    byContractor.set(id, list)
  }

  let sent = 0
  let skipped = 0
  let duplicate = 0
  let failed = 0

  for (const contractor of contractors ?? []) {
    const row = contractor as {
      id: string
      contact_email: string | null
      company_name: string | null
      subscription_status: string | null
    }

    if (!row.contact_email || !MAILABLE_STATUSES.has(row.subscription_status ?? '')) {
      skipped += 1
      continue
    }

    const result = await sendLeadDigest({
      to: row.contact_email,
      contractorId: row.id,
      companyName: row.company_name,
      weekKey,
      weekLabel: label,
      leads: byContractor.get(row.id) ?? [],
    })

    if (result.sent) sent += 1
    else if (result.reason === 'duplicate') duplicate += 1
    else failed += 1
  }

  return NextResponse.json({ ok: true, weekKey, sent, skipped, duplicate, failed })
}
