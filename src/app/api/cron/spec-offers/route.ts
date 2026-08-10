import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { countSmsSentToday, isWithinSmsSendWindow } from '@/lib/twilio-sms'
import { offerReminderHours, purgeGraceHours } from '@/lib/spec/specOffer'
import { specSmsAllowlist } from '@/lib/spec/specSmsAllowlist'
import { sendSpecOfferSms } from '@/lib/spec/sendSpecOfferSms'
import { SPEC_BUILD_SELECT, type SpecBuildRow } from '@/lib/spec/types'

export const runtime = 'nodejs'

/**
 * Send offer and reminder texts, and expire offers whose deadline has passed.
 *
 * Runs ONCE A DAY, and must keep doing so: this project is on a Vercel plan
 * that rejects any cron expression firing more than once per day — the
 * deployment fails outright, it is not silently downgraded. Every other cron
 * here is daily for the same reason. An approved offer therefore waits up to a
 * day before its text goes out, which is fine against a 7-day deadline, and
 * /offer/[token] expires lapsed offers on read so the page never contradicts a
 * sweep that has not run yet.
 *
 * The ordering of the guards below IS the safety property, and it mirrors
 * /api/cron/sms-followups deliberately:
 *
 *   send window → daily cap → allowlist → suppression →
 *   INSERT the event row first → send → record the outcome
 *
 * Inserting first is what makes this idempotent: `event_key` is unique, so a
 * duplicate insert fails with 23505 and we skip rather than texting somebody
 * twice. Sending first and recording after would double-message every business
 * on any retry.
 */


function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

async function run(req: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
  }
  if ((req.headers.get('authorization') || '') !== `Bearer ${secret}`) return unauthorized()

  const supabase = getSupabaseAdmin()
  const now = Date.now()

  // ── Expire first, so a lapsed offer is never reminded about ──
  const { data: lapsed } = await supabase
    .from('spec_builds')
    .select('id')
    .in('status', ['offer_sent', 'offer_reminded'])
    .lt('offer_deadline_at', new Date(now).toISOString())
    .limit(100)

  let expired = 0
  for (const row of (lapsed ?? []) as { id: string }[]) {
    const { error } = await supabase
      .from('spec_builds')
      .update({
        status: 'expired',
        purge_after: new Date(now + purgeGraceHours() * 3600_000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .in('status', ['offer_sent', 'offer_reminded'])
    if (!error) expired += 1
  }

  if (!isWithinSmsSendWindow()) {
    return NextResponse.json({ ok: true, expired, skipped: 'outside_send_window' })
  }

  const maxDaily = Number.parseInt(process.env.SMS_MAX_DAILY || '50', 10) || 50
  let sentToday = await countSmsSentToday()
  if (sentToday >= maxDaily) {
    return NextResponse.json({ ok: true, expired, skipped: 'daily_cap', sentToday, maxDaily })
  }

  const tally = {
    expired,
    sent: 0,
    reminded: 0,
    skippedAllowlist: 0,
    skippedSuppressed: 0,
    skippedDuplicate: 0,
    failed: 0,
    allowlistActive: specSmsAllowlist().length > 0,
  }

  // ── First sends: approved builds with an offer token ──
  const { data: toSend } = await supabase
    .from('spec_builds')
    .select(SPEC_BUILD_SELECT)
    .eq('status', 'approved')
    .not('offer_token', 'is', null)
    .limit(25)

  // ── Reminders: sent offers inside the reminder window ──
  const reminderCutoff = new Date(now + offerReminderHours() * 3600_000).toISOString()
  const { data: toRemind } = await supabase
    .from('spec_builds')
    .select(SPEC_BUILD_SELECT)
    .eq('status', 'offer_sent')
    .lt('offer_deadline_at', reminderCutoff)
    .limit(25)

  const work: { build: SpecBuildRow; step: 1 | 2 }[] = [
    ...((toSend ?? []) as SpecBuildRow[]).map((b) => ({ build: b, step: 1 as const })),
    ...((toRemind ?? []) as SpecBuildRow[]).map((b) => ({ build: b, step: 2 as const })),
  ]

  for (const { build, step } of work) {
    if (sentToday >= maxDaily) break

    // One shared sender for the cron and the admin's send button, so the
    // allowlist, the suppression check and the duplicate guard cannot drift
    // apart between the two paths.
    const outcome = await sendSpecOfferSms(build, step)
    if (outcome.sent) {
      sentToday += 1
      if (step === 1) tally.sent += 1
      else tally.reminded += 1
      continue
    }
    switch (outcome.reason) {
      case 'not_allowlisted':
        tally.skippedAllowlist += 1
        break
      case 'suppressed':
        tally.skippedSuppressed += 1
        break
      case 'already_sent':
        tally.skippedDuplicate += 1
        break
      default:
        tally.failed += 1
    }
  }

  return NextResponse.json({ ok: true, ...tally, sentToday, maxDaily })
}

export async function GET(req: Request) {
  return run(req)
}
export async function POST(req: Request) {
  return run(req)
}
