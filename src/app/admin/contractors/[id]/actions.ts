'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin, logAdminAction } from '@/lib/admin'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getStripe } from '@/lib/stripe'

function addDays(base: Date, days: number): Date {
  const d = new Date(base.getTime())
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

function addMonths(base: Date, months: number): Date {
  const d = new Date(base.getTime())
  d.setUTCMonth(d.getUTCMonth() + months)
  return d
}

async function loadContractor(id: string) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('contractor_settings')
    .select(
      'id, company_name, contact_email, subscription_status, subscription_plan, trial_ends_at, current_period_end, stripe_customer_id, stripe_subscription_id'
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Contractor not found')
  return data
}

/** Extend (or start) the free trial by N days from the later of now and the existing trial_ends_at. */
export async function extendTrialAction(formData: FormData) {
  const me = await requireAdmin()
  const contractorId = String(formData.get('contractor_id') ?? '')
  const days = Math.max(1, Math.min(365, Number(formData.get('days') ?? 0)))
  if (!contractorId || !days) throw new Error('contractor_id and days required')

  const before = await loadContractor(contractorId)

  const now = new Date()
  const baseline =
    before.trial_ends_at && new Date(before.trial_ends_at) > now
      ? new Date(before.trial_ends_at)
      : now
  const newTrialEnd = addDays(baseline, days)

  const admin = getSupabaseAdmin()
  const { error } = await admin
    .from('contractor_settings')
    .update({
      trial_ends_at: newTrialEnd.toISOString(),
      subscription_status: 'trialing',
    })
    .eq('id', contractorId)
  if (error) throw error

  await logAdminAction({
    actor: me,
    action: 'contractor.trial_extended',
    targetType: 'contractor',
    targetId: contractorId,
    metadata: {
      days,
      previous_trial_ends_at: before.trial_ends_at,
      new_trial_ends_at: newTrialEnd.toISOString(),
      previous_status: before.subscription_status,
    },
  })

  revalidatePath(`/admin/contractors/${contractorId}`)
  revalidatePath('/admin/contractors')
  revalidatePath('/admin/subscriptions')
}

/** Comp the account for N months. Sets status='comp' and pushes current_period_end out. */
export async function compAction(formData: FormData) {
  const me = await requireAdmin()
  const contractorId = String(formData.get('contractor_id') ?? '')
  const months = Math.max(1, Math.min(60, Number(formData.get('months') ?? 0)))
  const reason = String(formData.get('reason') ?? '').slice(0, 280)
  if (!contractorId || !months) throw new Error('contractor_id and months required')

  const before = await loadContractor(contractorId)

  const now = new Date()
  const baseline =
    before.current_period_end && new Date(before.current_period_end) > now
      ? new Date(before.current_period_end)
      : now
  const newPeriodEnd = addMonths(baseline, months)

  const admin = getSupabaseAdmin()
  const { error } = await admin
    .from('contractor_settings')
    .update({
      subscription_status: 'comp',
      current_period_end: newPeriodEnd.toISOString(),
    })
    .eq('id', contractorId)
  if (error) throw error

  await logAdminAction({
    actor: me,
    action: 'contractor.comped',
    targetType: 'contractor',
    targetId: contractorId,
    metadata: {
      months,
      reason,
      previous_status: before.subscription_status,
      previous_period_end: before.current_period_end,
      new_period_end: newPeriodEnd.toISOString(),
    },
  })

  revalidatePath(`/admin/contractors/${contractorId}`)
  revalidatePath('/admin/contractors')
  revalidatePath('/admin/subscriptions')
}

/** Mark canceled in our DB. Optionally also cancel the live Stripe subscription. */
export async function markCanceledAction(formData: FormData) {
  const me = await requireAdmin()
  const contractorId = String(formData.get('contractor_id') ?? '')
  const cancelInStripe = formData.get('cancel_in_stripe') === 'on'
  const reason = String(formData.get('reason') ?? '').slice(0, 280)
  if (!contractorId) throw new Error('contractor_id required')

  const before = await loadContractor(contractorId)

  let stripeResult: 'skipped' | 'canceled' | 'error' = 'skipped'
  let stripeError: string | null = null
  if (cancelInStripe && before.stripe_subscription_id) {
    try {
      const stripe = getStripe()
      await stripe.subscriptions.cancel(before.stripe_subscription_id)
      stripeResult = 'canceled'
    } catch (err) {
      stripeResult = 'error'
      stripeError = err instanceof Error ? err.message : String(err)
    }
  }

  const admin = getSupabaseAdmin()
  const { error } = await admin
    .from('contractor_settings')
    .update({ subscription_status: 'canceled' })
    .eq('id', contractorId)
  if (error) throw error

  await logAdminAction({
    actor: me,
    action: 'contractor.marked_canceled',
    targetType: 'contractor',
    targetId: contractorId,
    metadata: {
      reason,
      previous_status: before.subscription_status,
      stripe_subscription_id: before.stripe_subscription_id,
      stripe_cancel_result: stripeResult,
      stripe_cancel_error: stripeError,
    },
  })

  revalidatePath(`/admin/contractors/${contractorId}`)
  revalidatePath('/admin/contractors')
  revalidatePath('/admin/subscriptions')
}
