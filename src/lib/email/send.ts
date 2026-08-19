import { Resend } from 'resend'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { platformFromEmail } from '@/lib/fromEmail'

/**
 * The one place the platform sends mail.
 *
 * Every send is recorded in `email_sends`, which answers the questions that
 * previously had no answer: did this customer's lead notification actually
 * arrive, and have we already told them their card failed. The second one is
 * why `idempotencyKey` exists — a dunning cron that runs hourly must be able to
 * retry without emailing the same person six times.
 *
 * Never throws. A failed notification should not fail the request that produced
 * the underlying event: a lead that was captured but not emailed is recoverable,
 * a lead that 500'd on the customer's website is not.
 */

export type SendResult =
  | { sent: true; id: string | null }
  | { sent: false; reason: 'duplicate' | 'unconfigured' | 'error'; error?: string }

export async function sendEmail(opts: {
  kind: string
  to: string
  subject: string
  html: string
  /** Same key = same logical message. A repeat is reported, not resent. */
  idempotencyKey?: string
  contractorId?: string | null
  intakeId?: string | null
  replyTo?: string
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY unset, skipping ${opts.kind}`)
    return { sent: false, reason: 'unconfigured' }
  }

  const admin = getSupabaseAdmin()

  // Claim the send first. The unique index on idempotency_key is what makes
  // this safe under a retrying cron: whoever inserts the row owns the send.
  let rowId: string | null = null
  if (opts.idempotencyKey) {
    const { data, error } = await admin
      .from('email_sends')
      .insert({
        kind: opts.kind,
        to_email: opts.to,
        subject: opts.subject,
        contractor_id: opts.contractorId ?? null,
        intake_id: opts.intakeId ?? null,
        idempotency_key: opts.idempotencyKey,
        status: 'sending',
      })
      .select('id')
      .single()

    if (error) {
      // 23505 is the unique violation: this message already went out.
      if (error.code === '23505') return { sent: false, reason: 'duplicate' }
      console.warn(`[email] could not claim ${opts.kind}:`, error.message)
    } else {
      rowId = data?.id ?? null
    }
  }

  try {
    const resend = new Resend(apiKey)
    const { data, error } = await resend.emails.send({
      from: platformFromEmail(),
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
    })

    if (error) throw new Error(error.message)

    await record(admin, rowId, opts, {
      status: 'sent',
      provider_message_id: data?.id ?? null,
    })
    return { sent: true, id: data?.id ?? null }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[email] ${opts.kind} failed:`, message)
    await record(admin, rowId, opts, { status: 'failed', error: message, failed_at: new Date().toISOString() })
    return { sent: false, reason: 'error', error: message }
  }
}

/** Update the claimed row, or write one when the send was not idempotency-keyed. */
async function record(
  admin: ReturnType<typeof getSupabaseAdmin>,
  rowId: string | null,
  opts: { kind: string; to: string; subject: string; contractorId?: string | null; intakeId?: string | null },
  patch: Record<string, unknown>
): Promise<void> {
  try {
    if (rowId) {
      await admin.from('email_sends').update(patch).eq('id', rowId)
      return
    }
    await admin.from('email_sends').insert({
      kind: opts.kind,
      to_email: opts.to,
      subject: opts.subject,
      contractor_id: opts.contractorId ?? null,
      intake_id: opts.intakeId ?? null,
      ...patch,
    })
  } catch (err) {
    // Logging the send must never break the send.
    console.warn('[email] could not record send:', err)
  }
}
