'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, logAdminAction } from '@/lib/admin'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getStripe } from '@/lib/stripe'
import { sendIntakeLaunchPaymentEmail } from '@/lib/intake/sendIntakeLaunchEmail'
import { getIntakePaymentSummary } from '@/lib/intake/intakePaymentStage'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'

function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.closetquotes.com').replace(/\/$/, '')
}

async function loadIntake(id: string) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('prospect_intakes')
    .select(
      `id, token, status, business_name, contact_email, notification_email,
       intake_tier, tier_total_cents, deposit_required_cents, deposit_paid_cents,
       deposit_status, build_paid_at, balance_paid_at, maintenance_plan,
       preview_approved_at, site_live_at, provisioned_contractor_id, maintenance_started_at`
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Intake not found')
  return data as ProspectIntakeRow & { token: string }
}

export async function approvePreviewAction(formData: FormData) {
  const me = await requireAdmin()
  const intakeId = String(formData.get('intake_id') ?? '')
  if (!intakeId) throw new Error('intake_id required')

  const row = await loadIntake(intakeId)
  if (row.status === 'draft') {
    throw new Error('Intake must be submitted before preview approval')
  }

  const now = new Date().toISOString()
  const admin = getSupabaseAdmin()
  const { error } = await admin
    .from('prospect_intakes')
    .update({ preview_approved_at: now, updated_at: now })
    .eq('id', intakeId)
  if (error) throw error

  const payment = getIntakePaymentSummary({ ...row, preview_approved_at: now })
  const email = row.contact_email || row.notification_email
  if (email && payment.checkoutKind && payment.amountCents > 0) {
    const payKind = payment.checkoutKind === 'balance' ? 'balance' : 'standard_build'
    await sendIntakeLaunchPaymentEmail({
      to: email,
      businessName: row.business_name,
      intakeUrl: `${siteOrigin()}/intake/${row.token}?pay=${payKind}`,
      amountLabel: payment.label,
      amountCents: payment.amountCents,
    })
  }

  await logAdminAction({
    actor: me,
    action: 'intake.preview_approved',
    targetType: 'intake',
    targetId: intakeId,
    metadata: { payment_stage: payment.stage },
  })

  revalidatePath('/admin/intakes')
  revalidatePath(`/admin/intakes/${intakeId}`)
}

export async function markSiteLiveAction(formData: FormData) {
  const me = await requireAdmin()
  const intakeId = String(formData.get('intake_id') ?? '')
  if (!intakeId) throw new Error('intake_id required')

  const row = await loadIntake(intakeId)
  const now = new Date().toISOString()
  const admin = getSupabaseAdmin()
  const { error } = await admin
    .from('prospect_intakes')
    .update({ site_live_at: now, updated_at: now })
    .eq('id', intakeId)
  if (error) throw error

  await logAdminAction({
    actor: me,
    action: 'intake.site_live',
    targetType: 'intake',
    targetId: intakeId,
    metadata: { maintenance_plan: row.maintenance_plan },
  })

  revalidatePath('/admin/intakes')
  revalidatePath(`/admin/intakes/${intakeId}`)
}

export async function refundDepositAction(formData: FormData) {
  const me = await requireAdmin()
  const intakeId = String(formData.get('intake_id') ?? '')
  if (!intakeId) throw new Error('intake_id required')

  const row = await loadIntake(intakeId)
  if (row.deposit_status !== 'paid') {
    throw new Error('No paid deposit to refund')
  }

  const admin = getSupabaseAdmin()
  const { data: payment } = await admin
    .from('intake_payments')
    .select('stripe_session_id')
    .eq('intake_id', intakeId)
    .eq('kind', 'deposit')
    .eq('status', 'paid')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!payment?.stripe_session_id) {
    throw new Error('Deposit payment session not found')
  }

  const stripe = getStripe()
  const session = await stripe.checkout.sessions.retrieve(payment.stripe_session_id)
  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id

  if (!paymentIntentId) {
    throw new Error('No payment intent on deposit session')
  }

  await stripe.refunds.create({ payment_intent: paymentIntentId })

  await admin
    .from('intake_payments')
    .update({ status: 'refunded' })
    .eq('stripe_session_id', payment.stripe_session_id)

  await admin
    .from('prospect_intakes')
    .update({
      deposit_status: 'refunded',
      deposit_paid_cents: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', intakeId)

  await logAdminAction({
    actor: me,
    action: 'intake.deposit_refunded',
    targetType: 'intake',
    targetId: intakeId,
    metadata: { session_id: payment.stripe_session_id },
  })

  revalidatePath('/admin/intakes')
  revalidatePath(`/admin/intakes/${intakeId}`)
}
