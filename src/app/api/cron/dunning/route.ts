import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { sendPaymentFailedEmail, sendSubscriptionEndedEmail } from '@/lib/email/billingEmails'
import { PAST_DUE_GRACE_DAYS } from '@/lib/entitlement'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Follow-ups for failed payments, and the notice when the window closes.
 *
 * The webhook sends the first email at the moment the card fails; this sends
 * the reminders after it, and the "your calculator has stopped" notice when the
 * grace period expires. Split that way because Stripe delivers one event and
 * the reminders are time-based — there is nothing to hang them off.
 *
 * Every send is idempotency-keyed on (contractor, billing period, attempt), so
 * running this hourly does not mail anyone twice. That is what makes it safe to
 * schedule frequently, which matters: the previous alerting cron ran daily and
 * evaluated a two-minute SLO.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')?.trim()
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const admin = getSupabaseAdmin()
  const { data: rows, error } = await admin
    .from('contractor_settings')
    .select('id, contact_email, company_name, current_period_end, subscription_status')
    .eq('subscription_status', 'past_due')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const graceMs = PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000
  const now = Date.now()
  const results: Array<{ contractorId: string; action: string }> = []

  for (const row of rows ?? []) {
    const email = (row as { contact_email?: string | null }).contact_email
    const contractorId = (row as { id: string }).id
    if (!email) {
      results.push({ contractorId, action: 'skipped:no-email' })
      continue
    }

    const periodEndRaw = (row as { current_period_end?: string | null }).current_period_end
    const periodEnd = periodEndRaw ? new Date(periodEndRaw).getTime() : now
    const graceEnds = periodEnd + graceMs
    const daysLeft = Math.ceil((graceEnds - now) / 86_400_000)
    const periodKey = periodEndRaw ?? 'unknown'
    const companyName = (row as { company_name?: string | null }).company_name

    // Past the window: access has stopped, and they should hear it from us
    // rather than from their own website.
    if (daysLeft <= 0) {
      const sent = await sendSubscriptionEndedEmail({
        to: email,
        contractorId,
        companyName,
        reason: 'unpaid',
      })
      results.push({ contractorId, action: sent.sent ? 'ended-notice' : `ended:${sent.reason}` })
      continue
    }

    // Two reminders inside the window: one mid-way, one on the last day. The
    // idempotency key carries the attempt, so each lands at most once.
    const attempt: 2 | 3 | null =
      daysLeft <= 1 ? 3 : daysLeft <= Math.ceil(PAST_DUE_GRACE_DAYS / 2) ? 2 : null
    if (!attempt) {
      results.push({ contractorId, action: 'waiting' })
      continue
    }

    const sent = await sendPaymentFailedEmail({
      to: email,
      contractorId,
      companyName,
      attempt,
      daysLeft,
      periodKey,
    })
    results.push({
      contractorId,
      action: sent.sent ? `reminder-${attempt}` : `reminder-${attempt}:${sent.reason}`,
    })
  }

  return NextResponse.json({ pastDue: rows?.length ?? 0, results })
}
