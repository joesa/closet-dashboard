import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe, priceIdToPlan } from '@/lib/stripe'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Stripe webhook — single source of truth for subscription state.
 *
 * Test locally with:
 *   stripe listen --forward-to localhost:3000/api/webhooks/stripe
 *
 * Each handler is idempotent (single UPSERT or UPDATE keyed on either
 * stripe_subscription_id or stripe_customer_id).
 */
export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!sig || !secret) {
    return NextResponse.json({ error: 'Missing signature or secret' }, { status: 400 })
  }

  const raw = await req.text()
  const stripe = getStripe()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'invalid signature'
    return NextResponse.json({ error: `Webhook signature failed: ${msg}` }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // ── Persist the event for admin viewing (best-effort, idempotent on id) ──
  // Skip on conflict so Stripe retries don't double-write the payload.
  try {
    await admin.from('stripe_webhook_events').upsert(
      {
        id: event.id,
        type: event.type,
        payload: event as unknown as Record<string, unknown>,
        received_at: new Date().toISOString(),
        processed_at: null,
        process_error: null,
      },
      { onConflict: 'id', ignoreDuplicates: true }
    )
  } catch (persistErr) {
    console.error('Failed to persist webhook event:', persistErr)
  }

  let handlerError: string | null = null

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const meta = session.metadata ?? {}
        const kind = meta.kind

        if (kind === 'intake_deposit' && meta.intake_id) {
          const intakeId = meta.intake_id
          const amountCents = session.amount_total ?? 0

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
              kind: 'deposit',
              status: 'paid',
            })
          }

          await admin
            .from('prospect_intakes')
            .update({
              deposit_paid_cents: amountCents,
              deposit_status: 'paid',
              stripe_checkout_session_id: session.id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', intakeId)
        } else if (
          kind === 'widget_subscription' ||
          session.mode === 'subscription'
        ) {
          const userId = session.client_reference_id
          const customerId =
            typeof session.customer === 'string' ? session.customer : session.customer?.id
          const subscriptionId =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription?.id ?? null

          const skipDbTrial = meta.skip_db_trial === 'true'

          if (userId && customerId) {
            const patch: Record<string, unknown> = {
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
            }
            if (skipDbTrial) {
              patch.subscription_status = 'active'
              patch.trial_ends_at = new Date().toISOString()
            }
            await admin.from('contractor_settings').update(patch).eq('user_id', userId)
          }
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await syncSubscription(sub)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subId =
          // Stripe types are loose here across API versions.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (invoice as any).subscription as string | Stripe.Subscription | null | undefined
        const subscriptionId =
          typeof subId === 'string' ? subId : subId?.id ?? null
        if (subscriptionId) {
          await admin
            .from('contractor_settings')
            .update({ subscription_status: 'past_due' })
            .eq('stripe_subscription_id', subscriptionId)
        }
        break
      }

      default:
        // Unhandled event types are fine — return 200 so Stripe stops retrying.
        break
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
    handlerError = err instanceof Error ? err.message : String(err)
  }

  // Mark the persisted event as processed (or record the error).
  try {
    await admin
      .from('stripe_webhook_events')
      .update({
        processed_at: new Date().toISOString(),
        process_error: handlerError,
      })
      .eq('id', event.id)
  } catch (markErr) {
    console.error('Failed to mark webhook event processed:', markErr)
  }

  if (handlerError) {
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function syncSubscription(sub: Stripe.Subscription) {
  const admin = getSupabaseAdmin()
  const customerId =
    typeof sub.customer === 'string' ? sub.customer : sub.customer.id

  const priceId = sub.items.data[0]?.price.id ?? null
  const plan = priceIdToPlan(priceId)

  // Map Stripe statuses to our enum. Treat trialing/active/past_due/canceled
  // verbatim; everything else becomes 'incomplete'.
  const allowed = new Set(['trialing', 'active', 'past_due', 'canceled', 'incomplete'])
  const status = allowed.has(sub.status) ? sub.status : 'incomplete'

  // current_period_end lives on the subscription's first item in newer API
  // versions but the top-level field is still populated by Stripe for back-compat.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cpe = (sub as any).current_period_end as number | undefined
  const currentPeriodEnd = cpe ? new Date(cpe * 1000).toISOString() : null

  // Prefer matching by subscription_id, fall back to customer_id (handles the
  // race between checkout.session.completed and subscription.created arrivals).
  const update = {
    stripe_subscription_id: sub.id,
    stripe_customer_id: customerId,
    subscription_status: status,
    subscription_plan: plan,
    current_period_end: currentPeriodEnd,
  }

  const { data: bySub } = await admin
    .from('contractor_settings')
    .update(update)
    .eq('stripe_subscription_id', sub.id)
    .select('id')

  if (!bySub || bySub.length === 0) {
    await admin
      .from('contractor_settings')
      .update(update)
      .eq('stripe_customer_id', customerId)
  }
}
