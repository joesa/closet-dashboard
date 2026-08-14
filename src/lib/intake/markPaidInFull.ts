import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getStripe } from '@/lib/stripe'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'
import { isLaunchBuildPaid } from '@/lib/intake/intakePaymentStage'
import { syncTenantLaunchAccess } from '@/lib/intake/syncTenantLaunchAccess'
import { isDepositCleared } from '@/lib/intake/tiers'

export type PaidInFullResult = {
  alreadyPaid: boolean
  launchKind: 'standard_build' | 'balance'
  depositWaived: boolean
  /** Stripe checkout sessions expired so the customer can no longer be charged. */
  expiredSessionIds: string[]
  /** Non-fatal Stripe problems — the comp still applied (the DB is what gates access). */
  stripeWarnings: string[]
}

/** Which launch payment field this tier settles on. */
function launchKindFor(row: Pick<ProspectIntakeRow, 'intake_tier'>): 'standard_build' | 'balance' {
  return row.intake_tier === 'ai_premium' ? 'balance' : 'standard_build'
}

/**
 * Synthetic `intake_payments.stripe_session_id` for a comped payment.
 *
 * That column is NOT NULL + UNIQUE because it normally carries a real Stripe
 * session. A comp has no Stripe object, so we mint a deterministic id instead:
 * it keeps the ledger row honest about where the "payment" came from, and
 * makes re-running this action idempotent rather than inserting duplicates.
 */
function compSessionId(intakeId: string, kind: string): string {
  return `comp:${intakeId}:${kind}`
}

async function recordCompPayment(intakeId: string, kind: string): Promise<void> {
  const admin = getSupabaseAdmin()
  const stripeSessionId = compSessionId(intakeId, kind)
  const { data: existing } = await admin
    .from('intake_payments')
    .select('id')
    .eq('stripe_session_id', stripeSessionId)
    .maybeSingle()
  if (existing) return
  await admin.from('intake_payments').insert({
    intake_id: intakeId,
    stripe_session_id: stripeSessionId,
    amount_cents: 0,
    kind,
    status: 'paid',
  })
}

/**
 * Expire any checkout session still open for this intake.
 *
 * Stripe has no "mark this session paid" API — a session only becomes paid by
 * an actual charge, and fabricating one would put money movement in Stripe
 * that never happened. What we can do is make sure a comped customer is never
 * charged later: an already-issued pay link stays live for 24h, so we expire
 * open sessions and let the DB (which is what actually gates the site) record
 * the comp.
 */
async function expireOpenStripeSessions(
  row: ProspectIntakeRow & { stripe_checkout_session_id?: string | null }
): Promise<{ expiredSessionIds: string[]; stripeWarnings: string[] }> {
  const expiredSessionIds: string[] = []
  const stripeWarnings: string[] = []

  const admin = getSupabaseAdmin()
  const { data: pendingPayments } = await admin
    .from('intake_payments')
    .select('stripe_session_id')
    .eq('intake_id', row.id)
    .eq('status', 'pending')

  const pendingRows = (Array.isArray(pendingPayments) ? pendingPayments : []) as Array<{
    stripe_session_id: string
  }>

  const candidates = [
    ...new Set(
      [
        row.stripe_checkout_session_id ?? null,
        ...pendingRows.map((payment) => payment.stripe_session_id),
      ].filter(
        (id): id is string => typeof id === 'string' && id.length > 0 && !id.startsWith('comp:')
      )
    ),
  ]

  if (candidates.length === 0) return { expiredSessionIds, stripeWarnings }

  let stripe: ReturnType<typeof getStripe>
  try {
    stripe = getStripe()
  } catch (err) {
    return {
      expiredSessionIds,
      stripeWarnings: [`Stripe not configured — open sessions left as-is: ${String(err)}`],
    }
  }

  for (const sessionId of candidates) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId)
      if (session.status !== 'open') continue
      await stripe.checkout.sessions.expire(sessionId)
      expiredSessionIds.push(sessionId)
    } catch (err) {
      stripeWarnings.push(`Could not expire ${sessionId}: ${String(err)}`)
    }
  }

  return { expiredSessionIds, stripeWarnings }
}

/**
 * Comp a build: mark every launch payment settled so the owner is never asked
 * to pay, and take the site live.
 *
 * Deposit is recorded as `waived` rather than `paid` — `isDepositCleared`
 * treats both as settled, but only one of them is true, and the difference
 * matters when reconciling revenue against Stripe.
 */
export async function markIntakePaidInFull(opts: {
  intakeId: string
  row: ProspectIntakeRow & { stripe_checkout_session_id?: string | null }
}): Promise<PaidInFullResult> {
  const { intakeId, row } = opts
  const admin = getSupabaseAdmin()
  const now = new Date().toISOString()
  const launchKind = launchKindFor(row)
  const alreadyPaid = isLaunchBuildPaid(row)

  const depositOutstanding =
    (row.deposit_required_cents || 0) > 0 && !isDepositCleared(row.deposit_status)

  const patch: Record<string, unknown> = { updated_at: now }

  // Payment can't be "complete" for an intake that never cleared preview
  // approval — the summary would fall back to the awaiting_preview stage and
  // the site would read as unlaunchable despite being paid.
  if (!row.preview_approved_at) patch.preview_approved_at = now
  if (depositOutstanding) patch.deposit_status = 'waived'
  if (launchKind === 'balance') {
    if (!row.balance_paid_at) patch.balance_paid_at = now
  } else if (!row.build_paid_at) {
    patch.build_paid_at = now
  }

  const { error } = await admin.from('prospect_intakes').update(patch).eq('id', intakeId)
  if (error) throw error

  await recordCompPayment(intakeId, launchKind)
  if (depositOutstanding) await recordCompPayment(intakeId, 'deposit')

  const { expiredSessionIds, stripeWarnings } = await expireOpenStripeSessions(row)

  if (row.provisioned_contractor_id) {
    // A temp preview window is meaningless now that access is permanent, and
    // leaving it set would let the revert job reopen the paid/unpaid question.
    await admin
      .from('tenants')
      .update({ temp_preview_expires_at: null, updated_at: now })
      .eq('id', row.provisioned_contractor_id)

    await syncTenantLaunchAccess({ tenantId: row.provisioned_contractor_id, intakeId })
  }

  return { alreadyPaid, launchKind, depositWaived: depositOutstanding, expiredSessionIds, stripeWarnings }
}
