'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, logAdminAction } from '@/lib/admin'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getStripe } from '@/lib/stripe'
import { sendIntakeLaunchPaymentEmail } from '@/lib/intake/sendIntakeLaunchEmail'
import { getIntakePaymentSummary } from '@/lib/intake/intakePaymentStage'
import { syncTenantLaunchAccess } from '@/lib/intake/syncTenantLaunchAccess'
import { grantTempPreview, revertTempPreviewNow } from '@/lib/intake/tempPreviewAccess'
import { markIntakePaidInFull, undoIntakePaidInFull, waiveIntakeMaintenance, undoWaiveIntakeMaintenance } from '@/lib/intake/markPaidInFull'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'
import { publicAppOrigin } from '@/lib/urls'

function siteOrigin(): string {
  return publicAppOrigin()
}

async function loadIntake(id: string) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('prospect_intakes')
    .select(
      `id, token, status, business_name, contact_email, notification_email,
       intake_tier, tier_total_cents, deposit_required_cents, deposit_paid_cents,
       deposit_status, build_paid_at, balance_paid_at, maintenance_plan,
       preview_approved_at, site_live_at, provisioned_contractor_id, maintenance_started_at,
       maintenance_waived_at, stripe_checkout_session_id`
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

  if (row.provisioned_contractor_id) {
    await syncTenantLaunchAccess({
      tenantId: row.provisioned_contractor_id,
      intakeId,
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

export async function enableTempPreviewAction(formData: FormData) {
  const me = await requireAdmin()
  const intakeId = String(formData.get('intake_id') ?? '')
  const hours = Number(formData.get('hours') ?? '')
  if (!intakeId) throw new Error('intake_id required')
  if (!Number.isFinite(hours) || hours <= 0) throw new Error('Invalid duration')

  const row = await loadIntake(intakeId)
  if (!row.provisioned_contractor_id) {
    throw new Error('Intake has no provisioned site yet')
  }

  const { expiresAt } = await grantTempPreview({
    tenantId: row.provisioned_contractor_id,
    intakeId,
    hours,
  })

  await logAdminAction({
    actor: me,
    action: 'intake.temp_preview_enabled',
    targetType: 'intake',
    targetId: intakeId,
    metadata: { hours, expires_at: expiresAt, tenant_id: row.provisioned_contractor_id },
  })

  revalidatePath('/admin/intakes')
  revalidatePath(`/admin/intakes/${intakeId}`)
}

/**
 * Comp the build: settle every launch payment and take the site live, for when
 * the owner is giving the build away rather than collecting for it.
 */
export async function markPaidInFullAction(formData: FormData) {
  const me = await requireAdmin()
  const intakeId = String(formData.get('intake_id') ?? '')
  const reason = String(formData.get('reason') ?? '').trim()
  if (!intakeId) throw new Error('intake_id required')

  const row = await loadIntake(intakeId)
  if (row.status === 'draft') {
    throw new Error('Intake must be submitted before it can be marked paid in full')
  }

  const result = await markIntakePaidInFull({ intakeId, row })

  await logAdminAction({
    actor: me,
    action: 'intake.marked_paid_in_full',
    targetType: 'intake',
    targetId: intakeId,
    metadata: {
      reason: reason || null,
      comped: !result.alreadyPaid,
      launch_kind: result.launchKind,
      deposit_waived: result.depositWaived,
      expired_stripe_sessions: result.expiredSessionIds,
      stripe_warnings: result.stripeWarnings,
      tenant_id: row.provisioned_contractor_id,
    },
  })

  revalidatePath('/admin/intakes')
  revalidatePath(`/admin/intakes/${intakeId}`)
}

/**
 * Undo a prior free/comped mark-paid-in-full. Refuses real Stripe-paid launches.
 */
export async function undoPaidInFullAction(formData: FormData) {
  const me = await requireAdmin()
  const intakeId = String(formData.get('intake_id') ?? '')
  const reason = String(formData.get('reason') ?? '').trim()
  if (!intakeId) throw new Error('intake_id required')

  const row = await loadIntake(intakeId)
  const result = await undoIntakePaidInFull({ intakeId, row })

  await logAdminAction({
    actor: me,
    action: 'intake.undid_paid_in_full',
    targetType: 'intake',
    targetId: intakeId,
    metadata: {
      reason: reason || null,
      launch_kind: result.launchKind,
      restored_deposit: result.restoredDeposit,
      deleted_comp_kinds: result.deletedCompKinds,
      site_status: result.siteStatus,
      tenant_id: row.provisioned_contractor_id,
    },
  })

  revalidatePath('/admin/intakes')
  revalidatePath(`/admin/intakes/${intakeId}`)
}

/** Waive ongoing monthly/yearly site maintenance for this intake. */
export async function waiveMaintenanceAction(formData: FormData) {
  const me = await requireAdmin()
  const intakeId = String(formData.get('intake_id') ?? '')
  const reason = String(formData.get('reason') ?? '').trim()
  if (!intakeId) throw new Error('intake_id required')

  const row = await loadIntake(intakeId)
  if (row.status === 'draft') {
    throw new Error('Intake must be submitted before maintenance can be waived')
  }

  const result = await waiveIntakeMaintenance({ intakeId, row })
  if (result.alreadyStarted) {
    throw new Error('Maintenance already started — cancel the Stripe subscription separately if needed')
  }

  await logAdminAction({
    actor: me,
    action: 'intake.maintenance_waived',
    targetType: 'intake',
    targetId: intakeId,
    metadata: {
      reason: reason || null,
      already_waived: result.alreadyWaived,
      tenant_id: row.provisioned_contractor_id,
    },
  })

  revalidatePath('/admin/intakes')
  revalidatePath(`/admin/intakes/${intakeId}`)
}

/** Undo a maintenance waiver so monthly/yearly fees are required again. */
export async function undoWaiveMaintenanceAction(formData: FormData) {
  const me = await requireAdmin()
  const intakeId = String(formData.get('intake_id') ?? '')
  const reason = String(formData.get('reason') ?? '').trim()
  if (!intakeId) throw new Error('intake_id required')

  const row = await loadIntake(intakeId)
  const result = await undoWaiveIntakeMaintenance({ intakeId, row })

  await logAdminAction({
    actor: me,
    action: 'intake.maintenance_waiver_undone',
    targetType: 'intake',
    targetId: intakeId,
    metadata: {
      reason: reason || null,
      restored: result.restored,
      tenant_id: row.provisioned_contractor_id,
    },
  })

  revalidatePath('/admin/intakes')
  revalidatePath(`/admin/intakes/${intakeId}`)
}

export async function disableTempPreviewAction(formData: FormData) {
  const me = await requireAdmin()
  const intakeId = String(formData.get('intake_id') ?? '')
  if (!intakeId) throw new Error('intake_id required')

  const row = await loadIntake(intakeId)
  if (!row.provisioned_contractor_id) {
    throw new Error('Intake has no provisioned site yet')
  }

  const result = await revertTempPreviewNow({
    tenantId: row.provisioned_contractor_id,
    intakeId,
  })

  await logAdminAction({
    actor: me,
    action: 'intake.temp_preview_disabled',
    targetType: 'intake',
    targetId: intakeId,
    metadata: { site_status: result.siteStatus, tenant_id: row.provisioned_contractor_id },
  })

  revalidatePath('/admin/intakes')
  revalidatePath(`/admin/intakes/${intakeId}`)
}
