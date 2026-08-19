import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseServer } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getEntitlementForUser } from '@/lib/entitlement'
import { DEMO_CONTRACTOR_ID } from '@/lib/demo'
import BillingActions from './BillingActions'
import BillingAutoCheckout from './BillingAutoCheckout'

export const dynamic = 'force-dynamic'

/**
 * /billing serves two audiences:
 *   - Expired-trial / never-paid users (sent here by middleware) — sees the
 *     lockout copy + upgrade buttons.
 *   - Active subscribers — sees a "Manage subscription" button that opens the
 *     Stripe Billing Portal.
 */
export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ canceled?: string; checkout?: string; plan?: string }>
}) {
  const supabase = await getSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const params = await searchParams
  const checkoutPlanEarly = params.plan === 'yearly' ? 'yearly' : 'monthly'
  const billingNext = new URLSearchParams()
  if (params.checkout === '1') {
    billingNext.set('checkout', '1')
    billingNext.set('plan', checkoutPlanEarly)
  }
  if (params.canceled === 'true') billingNext.set('canceled', 'true')
  const billingPath =
    billingNext.size > 0 ? `/billing?${billingNext.toString()}` : '/billing'

  // Middleware should have caught this, but defense-in-depth.
  if (!user) redirect(`/login?next=${encodeURIComponent(billingPath)}`)

  const admin = getSupabaseAdmin()
  let ent = await getEntitlementForUser(user.id)

  // Self-heal: signup used to skip creating contractor_settings (missing DB trigger).
  if (!ent.contractorId) {
    const trialEnds = new Date()
    trialEnds.setUTCDate(trialEnds.getUTCDate() + 30)
    await admin.from('contractor_settings').insert({
      user_id: user.id,
      contact_email: user.email || '',
      subscription_status: 'trialing',
      trial_ends_at: trialEnds.toISOString(),
    })
    ent = await getEntitlementForUser(user.id)
    if (ent.isEntitled) redirect('/dashboard')
  }

  const justCanceled = params.canceled === 'true'
  const autoCheckout = params.checkout === '1'
  const checkoutPlan = params.plan === 'yearly' ? 'yearly' : 'monthly'

  const isActive = ent.status === 'active'
  const inTrial = ent.isEntitled && ent.status === 'trialing'
  const needsSetup = !ent.contractorId
  // A declined card is not an expired trial. This page told a two-year paying
  // customer whose Amex expired that their "30-Day Free Trial has concluded"
  // and invited them to upgrade — while their live quote calculator was the
  // thing that had actually broken.
  const pastDue = ent.status === 'past_due'
  const graceDaysLeft = ent.graceDaysLeft
  const canceled = ent.status === 'canceled'

  // Is this the shared demo contractor? The demo never expires and can't be
  // upgraded — show an explanatory notice instead of the Stripe checkout UI.
  const { data: contractorRow } = await admin
    .from('contractor_settings')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  const isDemo = contractorRow?.id === DEMO_CONTRACTOR_ID

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-white/20">
      <header className="border-b border-white/[0.06]">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="text-sm font-bold tracking-tight">
            Ditch<span className="text-slate-400">TheForm</span>
          </Link>
          <Link
            href="/dashboard"
            className="text-xs font-medium text-slate-500 transition hover:text-white"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-6 py-16">
        <div className="w-full max-w-lg">
          {isDemo ? (
            <>
              <div className="mb-10 text-center">
                <h1 className="text-4xl font-bold tracking-tighter text-white sm:text-5xl">
                  This is the DitchTheForm demo account.
                </h1>
                <p className="mx-auto mt-4 max-w-md text-base text-slate-400">
                  The demo is free forever and isn’t tied to a subscription, so
                  there’s nothing to upgrade here. To run your own quoting site
                  with real lead capture, create your own account — it’s free
                  for 30 days, no credit card required.
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-sm space-y-4">
                <Link
                  href="/signup"
                  className="block w-full rounded-lg bg-white px-6 py-3 text-center text-base font-medium text-black transition-colors hover:bg-gray-200"
                >
                  Start your free 30-day trial
                </Link>
                <Link
                  href="/dashboard"
                  className="block w-full rounded-lg border border-white/10 bg-white/[0.02] px-6 py-3 text-center text-sm font-medium text-slate-300 transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  Back to the demo dashboard
                </Link>
              </div>

              <p className="mt-6 text-center text-xs text-slate-600">
                Questions? <a href="mailto:admin@ditchtheform.com" className="underline hover:text-slate-400">admin@ditchtheform.com</a>
              </p>
            </>
          ) : (
            <>
              <div className="mb-10 text-center">
                <h1 className="text-4xl font-bold tracking-tighter text-white sm:text-5xl">
                  {isActive
                    ? 'You’re on DitchTheForm Pro.'
                    : pastDue
                      ? 'We couldn’t process your payment.'
                      : inTrial
                        ? 'Your free trial is active.'
                        : needsSetup
                          ? 'Finish setting up your account.'
                          : canceled
                            ? 'Your subscription has ended.'
                            : 'Your 30-Day Free Trial has concluded.'}
                </h1>
                <p className="mx-auto mt-4 max-w-md text-base text-slate-400">
                  {isActive
                    ? 'Manage your subscription, update your card, or switch your billing cadence below.'
                    : pastDue
                      ? graceDaysLeft > 0
                        ? `Your card was declined. Your calculator is still live and still capturing leads — update your card within ${graceDaysLeft} day${graceDaysLeft === 1 ? '' : 's'} to keep it that way.`
                        : 'Your card was declined and your calculator has stopped accepting new quotes. Updating your card brings it straight back — your settings, pricing and leads are all still here.'
                      : inTrial
                        ? `You have ${ent.daysLeftInTrial} day${ent.daysLeftInTrial === 1 ? '' : 's'} left. Subscribe anytime, or continue to your dashboard.`
                        : needsSetup
                          ? 'We could not find your contractor profile. Return to signup or contact support.'
                          : canceled
                            ? 'Your settings, pricing and past leads are all still here. Restarting brings your calculator straight back.'
                            : 'To keep generating interactive quotes and capturing SMS leads, upgrade to DitchTheForm Pro.'}
                </p>
                {justCanceled && !isActive && (
                  <p className="mt-3 text-sm text-amber-300">
                    Checkout was canceled. No charge was made.
                  </p>
                )}
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-sm">
                <BillingAutoCheckout
                  enabled={autoCheckout && !isActive}
                  plan={checkoutPlan}
                />
                <BillingActions
                  isActive={isActive}
                  currentPlan={ent.plan}
                  currentPeriodEnd={ent.currentPeriodEnd}
                />
              </div>

              <p className="mt-6 text-center text-xs text-slate-600">
                Questions? <a href="mailto:admin@ditchtheform.com" className="underline hover:text-slate-400">admin@ditchtheform.com</a>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
