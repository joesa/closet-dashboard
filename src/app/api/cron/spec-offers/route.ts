import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  SPEC_OFFER_SMS_TEMPLATES,
  countSmsSentToday,
  isPhoneSuppressed,
  isWithinSmsSendWindow,
  personalizeTemplate,
  sendSms,
} from '@/lib/twilio-sms'
import {
  offerReminderHours,
  offerUrl,
  priceSpecOffer,
  purgeGraceHours,
} from '@/lib/spec/specOffer'
import { specSmsAllowed, specSmsAllowlist } from '@/lib/spec/specSmsAllowlist'
import { SPEC_BUILD_SELECT, type SpecBuildRow } from '@/lib/spec/types'

export const runtime = 'nodejs'

/**
 * Send offer and reminder texts, and expire offers whose deadline has passed.
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

const PG_UNIQUE_VIOLATION = '23505'

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function fmtDeadline(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Chicago',
  })
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
    if (!build.offer_token || !build.offer_deadline_at) continue

    if (!specSmsAllowed(build.phone_e164)) {
      tally.skippedAllowlist += 1
      continue
    }
    if (await isPhoneSuppressed(build.phone_e164)) {
      tally.skippedSuppressed += 1
      continue
    }

    const pricing = priceSpecOffer(build.offer_discount_bps)
    const template = SPEC_OFFER_SMS_TEMPLATES.find((t) => t.step === step)
    if (!template) continue

    const body = personalizeTemplate(template.body, {
      businessName: build.business_name,
      offerUrl: offerUrl(build.offer_token),
      offerLabel: pricing.offerLabel,
      listLabel: pricing.listLabel,
      percentOff: String(pricing.percentOff),
      deadlineLabel: fmtDeadline(build.offer_deadline_at),
    })

    // Claim the send before making it. run_id is NOT NULL on this table and a
    // manual lead has no scraper run, hence the synthetic value.
    const eventKey = `spec:${build.id}:${step === 1 ? 'offer' : 'reminder'}`
    const { error: claimError } = await supabase.from('sms_outreach_events').insert({
      event_key: eventKey,
      run_id: build.scraper_run_id || `spec:${build.id}`,
      phone_number: build.phone_e164,
      business_name: build.business_name,
      source_location: build.city,
      message_step: step,
      message_body: body,
      status: 'pending',
    })
    if (claimError) {
      if (claimError.code === PG_UNIQUE_VIOLATION) tally.skippedDuplicate += 1
      else tally.failed += 1
      continue
    }

    const result = await sendSms(build.phone_e164, body)
    await supabase
      .from('sms_outreach_events')
      .update({
        status: result.success ? 'sent' : 'failed',
        twilio_message_sid: result.messageSid ?? null,
        error: result.success ? null : result.error ?? 'unknown',
        updated_at: new Date().toISOString(),
      })
      .eq('event_key', eventKey)

    if (!result.success) {
      tally.failed += 1
      continue
    }

    sentToday += 1
    await supabase
      .from('spec_builds')
      .update({
        status: step === 1 ? 'offer_sent' : 'offer_reminded',
        ...(step === 1
          ? { offer_sent_at: new Date().toISOString() }
          : { offer_reminded_at: new Date().toISOString() }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', build.id)

    if (step === 1) tally.sent += 1
    else tally.reminded += 1
  }

  return NextResponse.json({ ok: true, ...tally, sentToday, maxDaily })
}

export async function GET(req: Request) {
  return run(req)
}
export async function POST(req: Request) {
  return run(req)
}
