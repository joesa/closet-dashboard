import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseServer } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getEntitlementForUser } from '@/lib/entitlement'
import { DEMO_CONTRACTOR_ID } from '@/lib/demo'
import BillingActions from './BillingActions'

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
  searchParams: Promise<{ canceled?: string }>
}) {
  const supabase = await getSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Middleware should have caught this, but defense-in-depth.
  if (!user) redirect('/login?next=/billing')

  const ent = await getEntitlementForUser(user.id)
  const params = await searchParams
  const justCanceled = params.canceled === 'true'

  const isActive = ent.status === 'active'

  // Is this the shared demo contractor? The demo never expires and can't be
  // upgraded — show an explanatory notice instead of the Stripe checkout UI.
  const admin = getSupabaseAdmin()
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
            Closet<span className="text-slate-400">Quote</span>
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
                  This is the ClosetQuote demo account.
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
                Questions? <a href="mailto:admin@closetquotes.com" className="underline hover:text-slate-400">admin@closetquotes.com</a>
              </p>
            </>
          ) : (
            <>
              <div className="mb-10 text-center">
                <h1 className="text-4xl font-bold tracking-tighter text-white sm:text-5xl">
                  {isActive
                    ? 'You’re on ClosetQuote Pro.'
                    : 'Your 30-Day Free Trial has concluded.'}
                </h1>
                <p className="mx-auto mt-4 max-w-md text-base text-slate-400">
                  {isActive
                    ? 'Manage your subscription, update your card, or switch your billing cadence below.'
                    : 'To keep generating interactive quotes and capturing SMS leads, upgrade to ClosetQuote Pro.'}
                </p>
                {justCanceled && !isActive && (
                  <p className="mt-3 text-sm text-amber-300">
                    Checkout was canceled. No charge was made.
                  </p>
                )}
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-sm">
                <BillingActions
                  isActive={isActive}
                  currentPlan={ent.plan}
                  currentPeriodEnd={ent.currentPeriodEnd}
                />
              </div>

              <p className="mt-6 text-center text-xs text-slate-600">
                Questions? <a href="mailto:admin@closetquotes.com" className="underline hover:text-slate-400">admin@closetquotes.com</a>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
