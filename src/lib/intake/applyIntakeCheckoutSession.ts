import type Stripe from 'stripe'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

type ApplyResult = {
  applied: boolean
  paymentKind: 'deposit' | 'balance' | 'standard_build' | 'maintenance' | null
}

/**
 * Apply an intake-related Stripe checkout session to the prospect_intakes row.
 *
 * This is the single source of truth shared by the Stripe webhook and the
 * synchronous payment-confirmation endpoint (hit on the checkout success
 * redirect). It is idempotent: re-running with the same session is a no-op
 * because intake_payments rows are keyed on stripe_session_id and the intake
 * patch is deterministic.
 *
 * Only sessions whose `payment_status` is `paid` (or `no_payment_required`)
 * are applied. Subscription sessions (maintenance) are considered applied once
 * the session is complete.
 */
export async function applyIntakeCheckoutSession(
  session: Stripe.Checkout.Session
): Promise<ApplyResult> {
  const meta = session.metadata ?? {}
  const kind = meta.kind
  const intakeId = meta.intake_id

  if (!intakeId) return { applied: false, paymentKind: null }

  const isPaid =
    session.payment_status === 'paid' ||
    session.payment_status === 'no_payment_required'

  const admin = getSupabaseAdmin()

  if (
    kind === 'intake_deposit' ||
    kind === 'intake_balance' ||
    kind === 'intake_standard_build'
  ) {
    if (!isPaid) return { applied: false, paymentKind: null }

    const amountCents = session.amount_total ?? 0
    const paymentKind =
      kind === 'intake_balance'
        ? 'balance'
        : kind === 'intake_standard_build'
          ? 'standard_build'
          : 'deposit'

    const { data: existingPayment } = await admin
      .from('intake_payments')
      .select('id')
      .eq('stripe_session_id', session.id)
      .maybeSingle()

    if (!existingPayment) {
      await admin.from('intake_payments').insert({
        intake_id: intakeId,
        stripe_session_id: session.id,
        amount_cents: amountCents,
        kind: paymentKind,
        status: 'paid',
      })
    }

    const now = new Date().toISOString()
    const intakePatch: Record<string, unknown> = {
      stripe_checkout_session_id: session.id,
      updated_at: now,
    }

    if (paymentKind === 'deposit') {
      intakePatch.deposit_paid_cents = amountCents
      intakePatch.deposit_status = 'paid'
    } else if (paymentKind === 'balance') {
      intakePatch.balance_paid_at = now
    } else {
      intakePatch.build_paid_at = now
    }

    await admin.from('prospect_intakes').update(intakePatch).eq('id', intakeId)

    if (paymentKind === 'balance' || paymentKind === 'standard_build') {
      const { data: linked } = await admin
        .from('prospect_intakes')
        .select('provisioned_contractor_id')
        .eq('id', intakeId)
        .maybeSingle()

      if (linked?.provisioned_contractor_id) {
        await admin
          .from('tenants')
          .update({
            site_status: 'active',
            updated_at: now,
          })
          .eq('id', linked.provisioned_contractor_id)
      }
    }

    return { applied: true, paymentKind }
  }

  if (kind === 'intake_maintenance') {
    if (session.status !== 'complete') return { applied: false, paymentKind: null }

    const contractorId = meta.contractor_id as string | undefined
    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id
    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id ?? null
    const plan: 'monthly' | 'yearly' | null =
      meta.maintenance_plan === 'yearly'
        ? 'yearly'
        : meta.maintenance_plan === 'monthly'
          ? 'monthly'
          : null

    if (contractorId && customerId) {
      await admin
        .from('contractor_settings')
        .update({
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          subscription_status: 'active',
          subscription_plan: plan,
          trial_ends_at: new Date().toISOString(),
        })
        .eq('id', contractorId)
    }

    await admin
      .from('prospect_intakes')
      .update({
        maintenance_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', intakeId)

    return { applied: true, paymentKind: 'maintenance' }
  }

  return { applied: false, paymentKind: null }
}
