'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, logAdminAction } from '@/lib/admin'
import { getStripe } from '@/lib/stripe'

/**
 * Issue a refund against a charge or payment_intent surfaced from a
 * persisted Stripe event. Amount is in dollars; converted to cents.
 * Empty amount = full refund.
 */
export async function refundAction(formData: FormData) {
  const me = await requireAdmin()
  const eventId = String(formData.get('event_id') ?? '')
  const targetType = String(formData.get('target_type') ?? '') as 'charge' | 'payment_intent'
  const targetId = String(formData.get('target_id') ?? '')
  const amountRaw = String(formData.get('amount') ?? '').trim()
  const reasonRaw = String(formData.get('reason') ?? '').trim()

  if (!eventId || !targetId || !targetType) {
    throw new Error('event_id, target_type and target_id are required')
  }
  if (targetType !== 'charge' && targetType !== 'payment_intent') {
    throw new Error('target_type must be charge or payment_intent')
  }

  const stripe = getStripe()

  // Build refund params. Amount must be in the smallest currency unit (cents).
  const params: {
    charge?: string
    payment_intent?: string
    amount?: number
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
    metadata?: Record<string, string>
  } = {
    metadata: {
      admin_actor: me.email ?? me.id,
      source_event_id: eventId,
    },
  }
  if (targetType === 'charge') params.charge = targetId
  else params.payment_intent = targetId

  if (amountRaw) {
    const cents = Math.round(Number(amountRaw) * 100)
    if (!Number.isFinite(cents) || cents <= 0) {
      throw new Error('Amount must be a positive number of dollars')
    }
    params.amount = cents
  }

  if (reasonRaw === 'duplicate' || reasonRaw === 'fraudulent' || reasonRaw === 'requested_by_customer') {
    params.reason = reasonRaw
  }

  let refundId: string
  let refundAmount: number
  let refundStatus: string | null
  try {
    const refund = await stripe.refunds.create(params)
    refundId = refund.id
    refundAmount = refund.amount
    refundStatus = refund.status
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await logAdminAction({
      actor: me,
      action: 'stripe.refund_failed',
      targetType: 'stripe_event',
      targetId: eventId,
      metadata: {
        target_type: targetType,
        target_id: targetId,
        amount_requested_cents: params.amount ?? null,
        reason: params.reason ?? null,
        error: msg,
      },
    })
    throw new Error(`Refund failed: ${msg}`)
  }

  await logAdminAction({
    actor: me,
    action: 'stripe.refund_issued',
    targetType: 'stripe_event',
    targetId: eventId,
    metadata: {
      target_type: targetType,
      target_id: targetId,
      refund_id: refundId,
      refund_amount_cents: refundAmount,
      refund_status: refundStatus,
      reason: params.reason ?? null,
    },
  })

  revalidatePath(`/admin/stripe-events/${eventId}`)
  revalidatePath('/admin/stripe-events')
}
