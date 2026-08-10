import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  SPEC_OFFER_SMS_TEMPLATES,
  isPhoneSuppressed,
  isWithinSmsSendWindow,
  personalizeTemplate,
  sendSms,
} from '@/lib/twilio-sms'
import { offerUrl, priceSpecOffer } from '@/lib/spec/specOffer'
import { derivePreviewPassword } from '@/lib/spec/specPreviewPassword'
import { specSmsAllowed } from '@/lib/spec/specSmsAllowlist'
import type { SpecBuildRow } from '@/lib/spec/types'

/**
 * Compose and send one offer or reminder text.
 *
 * Shared by the admin's send button and the cron so there is exactly one path
 * to a real person's phone. Two implementations would eventually disagree about
 * the allowlist or the duplicate guard, and the one that disagreed would be the
 * one that texted somebody twice.
 */

const PG_UNIQUE_VIOLATION = '23505'

export type SpecSmsOutcome =
  | { sent: true; body: string }
  | {
      sent: false
      reason:
        | 'not_allowlisted'
        | 'suppressed'
        | 'already_sent'
        | 'outside_window'
        | 'no_offer'
        | 'send_failed'
      detail?: string
      body?: string
    }

export function buildOfferSmsBody(build: SpecBuildRow, step: 1 | 2): string | null {
  if (!build.offer_token || !build.offer_deadline_at) return null
  const template = SPEC_OFFER_SMS_TEMPLATES.find((t) => t.step === step)
  if (!template) return null

  const pricing = priceSpecOffer(build.offer_discount_bps)
  return personalizeTemplate(template.body, {
    businessName: build.business_name,
    offerUrl: offerUrl(build.offer_token),
    offerLabel: pricing.offerLabel,
    listLabel: pricing.listLabel,
    percentOff: String(pricing.percentOff),
    deadlineLabel: new Date(build.offer_deadline_at).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      timeZone: 'America/Chicago',
    }),
    // Re-derived, never stored — a resend produces the same code without a
    // plaintext password sitting in the database waiting to leak.
    previewPassword: derivePreviewPassword(build.id),
  })
}

export async function sendSpecOfferSms(
  build: SpecBuildRow,
  step: 1 | 2,
  opts: { enforceWindow?: boolean } = {}
): Promise<SpecSmsOutcome> {
  const body = buildOfferSmsBody(build, step)
  if (!body) return { sent: false, reason: 'no_offer' }

  // Order matters and mirrors the cron. The allowlist comes first because it
  // answers "may we contact this person at all", where the rest answer "should
  // we send right now".
  if (!specSmsAllowed(build.phone_e164)) {
    return { sent: false, reason: 'not_allowlisted', body }
  }
  if (await isPhoneSuppressed(build.phone_e164)) {
    return { sent: false, reason: 'suppressed', body }
  }
  // The window protects the recipient from a text at an antisocial hour, so it
  // holds even when a human pressed the button. The caller reports that the
  // message is queued rather than pretending it went.
  if (opts.enforceWindow !== false && !isWithinSmsSendWindow()) {
    return { sent: false, reason: 'outside_window', body }
  }

  const supabase = getSupabaseAdmin()
  const eventKey = `spec:${build.id}:${step === 1 ? 'offer' : 'reminder'}`

  // Claim before sending. `event_key` is unique, so a duplicate insert fails
  // and we skip — sending first and recording after would double-text on any
  // retry, including an admin double-clicking the button.
  const { error: claimError } = await supabase.from('sms_outreach_events').insert({
    event_key: eventKey,
    // run_id is NOT NULL and a hand-entered lead has no scraper run.
    run_id: build.scraper_run_id || `spec:${build.id}`,
    phone_number: build.phone_e164,
    business_name: build.business_name,
    source_location: build.city,
    message_step: step,
    message_body: body,
    status: 'pending',
  })
  if (claimError) {
    if (claimError.code === PG_UNIQUE_VIOLATION) {
      return { sent: false, reason: 'already_sent', body }
    }
    return { sent: false, reason: 'send_failed', detail: claimError.message, body }
  }

  const result = await sendSms(build.phone_e164, body)
  await supabase
    .from('sms_outreach_events')
    .update({
      status: result.success ? 'sent' : 'failed',
      twilio_message_sid: result.messageSid ?? null,
      error: result.success ? null : (result.error ?? 'unknown'),
      updated_at: new Date().toISOString(),
    })
    .eq('event_key', eventKey)

  if (!result.success) {
    return { sent: false, reason: 'send_failed', detail: result.error ?? 'unknown', body }
  }

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

  return { sent: true, body }
}
