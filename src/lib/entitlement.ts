import { getSupabaseAdmin } from './supabase-admin'

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete'

export type Entitlement = {
  contractorId: string | null
  status: SubscriptionStatus
  plan: 'monthly' | 'yearly' | null
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  isEntitled: boolean
  /** True while a failed payment is still inside its recovery window. */
  inPastDueGrace: boolean
  /** When that window closes, if it applies. */
  graceEndsAt: string | null
  /** Whole days remaining in that window — computed here so a server component
   *  can render the deadline without calling Date.now() during render. */
  graceDaysLeft: number
  daysLeftInTrial: number
  stripeCustomerId: string | null
}

/** Pure entitlement decision, exported so the grace window is testable. */
export function computeEntitlement(
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

  // A failed card must not switch the customer's live widget off the same hour.
  //
  // Stripe sets past_due the moment an invoice fails, and this gate is what the
  // embedded calculator on their own website depends on — so the previous
  // behaviour was: their card expires, and the quote form their visitors are
  // using mid-funnel starts returning 402. They were told nothing (there were
  // no billing emails at all), and the billing page greeted them with "your
  // trial has concluded". That converts a recoverable card failure into a
  // support incident and usually a cancellation.
  //
  // Stripe retries a failed invoice over several days; this window covers that
  // period so recovery is silent when it works, and the dunning emails have
  // somewhere to land when it does not.
  const graceEndsAt = pastDueGraceEndsAt(row)
  const inPastDueGrace = status === 'past_due' && graceEndsAt !== null && graceEndsAt > now

  return {
    contractorId: row?.id ?? null,
    status,
    plan: (row?.subscription_plan as 'monthly' | 'yearly' | null) ?? null,
    trialEndsAt,
    currentPeriodEnd: row?.current_period_end ?? null,
    isEntitled: status === 'active' || inTrial || inPastDueGrace,
    inPastDueGrace,
    graceEndsAt: graceEndsAt ? new Date(graceEndsAt).toISOString() : null,
    graceDaysLeft: inPastDueGrace ? Math.max(0, Math.ceil((graceEndsAt! - now) / 86_400_000)) : 0,
    daysLeftInTrial,
    stripeCustomerId: row?.stripe_customer_id ?? null,
  }
}

/** How long a past_due subscription keeps working. Stripe's retries span days. */
export const PAST_DUE_GRACE_DAYS = 7

/**
 * Grace runs from the end of the paid period when we know it, so a customer
 * never gets less than the time they paid for; otherwise from now, which is the
 * safe direction when the period end is missing.
 */
function pastDueGraceEndsAt(row: { current_period_end?: string | null } | null): number | null {
  const graceMs = PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000
  const periodEnd = row?.current_period_end ? new Date(row.current_period_end).getTime() : NaN
  if (Number.isFinite(periodEnd)) return periodEnd + graceMs
  return Date.now() + graceMs
}

/** Look up entitlement for an authenticated user. */
export async function getEntitlementForUser(userId: string): Promise<Entitlement> {
  const admin = getSupabaseAdmin()
  const { data } = await admin
    .from('contractor_settings')
    .select('id, subscription_status, subscription_plan, trial_ends_at, current_period_end, stripe_customer_id')
    .eq('user_id', userId)
    .maybeSingle()
  return computeEntitlement(data)
}

/** Look up entitlement by public contractor id (used by widget APIs). */
export async function getEntitlementForContractor(contractorId: string): Promise<Entitlement> {
  const admin = getSupabaseAdmin()
  const { data } = await admin
    .from('contractor_settings')
    .select('id, subscription_status, subscription_plan, trial_ends_at, current_period_end, stripe_customer_id')
    .eq('id', contractorId)
    .maybeSingle()
  return computeEntitlement(data)
}
