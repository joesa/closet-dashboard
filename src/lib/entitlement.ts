import { getSupabaseAdmin } from './supabase-admin'

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete'

export type Entitlement = {
  contractorId: string | null
  status: SubscriptionStatus
  plan: 'monthly' | 'yearly' | null
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  isEntitled: boolean
  daysLeftInTrial: number
  stripeCustomerId: string | null
}

function compute(
  row: {
    id?: string
    subscription_status?: string | null
    subscription_plan?: string | null
    trial_ends_at?: string | null
    current_period_end?: string | null
    stripe_customer_id?: string | null
  } | null
): Entitlement {
  const status = (row?.subscription_status as SubscriptionStatus) || 'trialing'
  const trialEndsAt = row?.trial_ends_at ?? null
  const now = Date.now()
  const trialMs = trialEndsAt ? new Date(trialEndsAt).getTime() : 0
  const inTrial = status === 'trialing' && trialMs > now
  const daysLeftInTrial = inTrial
    ? Math.max(0, Math.ceil((trialMs - now) / (1000 * 60 * 60 * 24)))
    : 0

  return {
    contractorId: row?.id ?? null,
    status,
    plan: (row?.subscription_plan as 'monthly' | 'yearly' | null) ?? null,
    trialEndsAt,
    currentPeriodEnd: row?.current_period_end ?? null,
    isEntitled: status === 'active' || inTrial,
    daysLeftInTrial,
    stripeCustomerId: row?.stripe_customer_id ?? null,
  }
}

/** Look up entitlement for an authenticated user. */
export async function getEntitlementForUser(userId: string): Promise<Entitlement> {
  const admin = getSupabaseAdmin()
  const { data } = await admin
    .from('contractor_settings')
    .select('id, subscription_status, subscription_plan, trial_ends_at, current_period_end, stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle()
  return compute(data)
}

/** Look up entitlement by public contractor id (used by widget APIs). */
export async function getEntitlementForContractor(contractorId: string): Promise<Entitlement> {
  const admin = getSupabaseAdmin()
  const { data } = await admin
    .from('contractor_settings')
    .select('id, subscription_status, subscription_plan, trial_ends_at, current_period_end, stripe_customer_id')
    .eq('id', contractorId)
    .maybeSingle()
  return compute(data)
}
