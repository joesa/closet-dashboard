import { NextResponse } from 'next/server'
import { corsHeaders } from './cors'
import { getEntitlementForContractor } from './entitlement'

/**
 * Assert the given contractor is entitled to use the public widget APIs.
 * Returns `null` if entitled, or a 402 NextResponse to return if not.
 *
 * The 402 body shape is intentionally simple so the widget can render a
 * graceful "offline" state without needing to parse error codes.
 */
export async function assertEntitled(contractorId: string) {
  const ent = await getEntitlementForContractor(contractorId)
  if (ent.isEntitled) return null

  return NextResponse.json(
    {
      error: 'subscription_required',
      disabled: true,
      reason:
        ent.status === 'trialing'
          ? 'trial_expired'
          : ent.status === 'past_due'
            ? 'payment_past_due'
            : 'subscription_inactive',
    },
    { status: 402, headers: corsHeaders }
  )
}
