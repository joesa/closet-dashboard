import Link from 'next/link'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getStripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Row = {
  id: string
  company_name: string | null
  contact_email: string | null
  subscription_status: string | null
  subscription_plan: string | null
  current_period_end: string | null
}

type PriceInfo = { id: string; monthlyEquivalent: number; currency: string } | null

async function loadPrice(priceId: string | undefined, interval: 'month' | 'year'): Promise<PriceInfo> {
  if (!priceId) return null
  try {
    const stripe = getStripe()
    const price = await stripe.prices.retrieve(priceId)
    const amt = price.unit_amount ?? 0 // in cents
    const monthly = interval === 'year' ? amt / 12 : amt
    return { id: priceId, monthlyEquivalent: monthly / 100, currency: price.currency }
  } catch {
    return null
  }
}

export default async function SubscriptionsPage() {
  const admin = getSupabaseAdmin()

  const [{ data, error }, monthlyPrice, yearlyPrice] = await Promise.all([
    admin
      .from('contractor_settings')
      .select('id, company_name, contact_email, subscription_status, subscription_plan, current_period_end')
      .order('current_period_end', { ascending: true, nullsFirst: false })
      .limit(500),
    loadPrice(process.env.STRIPE_PRICE_MONTHLY, 'month'),
    loadPrice(process.env.STRIPE_PRICE_YEARLY, 'year'),
  ])

  const rows = (data ?? []) as Row[]

  const byStatus: Record<string, number> = {}
  const byPlan: Record<string, number> = {}
  let activeMonthly = 0
  let activeYearly = 0
  const trialingSoon: Row[] = []
  const pastDue: Row[] = []
  const recentCanceled: Row[] = []

  // eslint-disable-next-line react-hooks/purity -- async Server Component renders once per request; request time is intentional here
  const nowMs = Date.now()
  const soonCutoff = nowMs + 7 * 24 * 3600 * 1000

  for (const r of rows) {
    const s = r.subscription_status ?? 'unknown'
    byStatus[s] = (byStatus[s] ?? 0) + 1
    if (r.subscription_plan) {
      byPlan[r.subscription_plan] = (byPlan[r.subscription_plan] ?? 0) + 1
    }
    if (s === 'active') {
      if (r.subscription_plan === 'monthly') activeMonthly++
      else if (r.subscription_plan === 'yearly') activeYearly++
    }
    if (s === 'trialing' && r.current_period_end) {
      const t = new Date(r.current_period_end).getTime()
      if (t < soonCutoff && t > nowMs) trialingSoon.push(r)
    }
    if (s === 'past_due') pastDue.push(r)
    if (s === 'canceled') recentCanceled.push(r)
  }

  const mrr =
    (monthlyPrice?.monthlyEquivalent ?? 0) * activeMonthly +
    (yearlyPrice?.monthlyEquivalent ?? 0) * activeYearly
  const arr = mrr * 12

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Subscriptions</h1>
        <p className="mt-1 text-sm text-gray-500">
          Roll-up across all contractor accounts.
        </p>
      </header>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error.message}
        </div>
      )}

      {/* MRR / ARR */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gray-500">MRR</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">
            ${mrr.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="mt-1 text-xs text-gray-400">
            {activeMonthly} monthly + {activeYearly} yearly
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gray-500">ARR (est)</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">
            ${arr.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="mt-1 text-xs text-gray-400">MRR × 12</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gray-500">Active subs</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">
            {activeMonthly + activeYearly}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gray-500">Comp</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">
            {byStatus['comp'] ?? 0}
          </div>
        </div>
      </section>

      {/* Status & plan breakdown */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">By status</h2>
          <ul className="mt-3 divide-y divide-gray-100 text-sm">
            {Object.entries(byStatus)
              .sort((a, b) => b[1] - a[1])
              .map(([s, n]) => (
                <li key={s} className="flex items-center justify-between py-2">
                  <span className="font-mono text-xs text-gray-600">{s}</span>
                  <span className="font-semibold text-gray-900">{n}</span>
                </li>
              ))}
          </ul>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">By plan</h2>
          <ul className="mt-3 divide-y divide-gray-100 text-sm">
            {Object.keys(byPlan).length === 0 && (
              <li className="py-2 text-gray-500">No paid plans yet.</li>
            )}
            {Object.entries(byPlan)
              .sort((a, b) => b[1] - a[1])
              .map(([p, n]) => (
                <li key={p} className="flex items-center justify-between py-2">
                  <span className="font-mono text-xs text-gray-600">{p}</span>
                  <span className="font-semibold text-gray-900">{n}</span>
                </li>
              ))}
          </ul>
          <div className="mt-3 text-xs text-gray-400">
            Monthly price: {monthlyPrice ? `$${monthlyPrice.monthlyEquivalent.toFixed(2)}/mo` : 'n/a'} ·
            Yearly price: {yearlyPrice ? `$${(yearlyPrice.monthlyEquivalent * 12).toFixed(0)}/yr` : 'n/a'}
          </div>
        </div>
      </section>

      {/* Trials ending soon */}
      <ListSection title="Trials ending within 7 days" rows={trialingSoon} />
      <ListSection title="Past-due accounts" rows={pastDue} highlight="amber" />
      <ListSection title="Recently canceled" rows={recentCanceled.slice(0, 15)} />
    </div>
  )
}

function ListSection({
  title,
  rows,
  highlight,
}: {
  title: string
  rows: Row[]
  highlight?: 'amber'
}) {
  const headerCls = highlight === 'amber' ? 'text-amber-700' : 'text-gray-900'
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className={`text-sm font-semibold ${headerCls}`}>{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">None.</p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100 text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2">
              <div>
                <Link
                  href={`/admin/contractors/${r.id}`}
                  className="font-medium text-blue-700 hover:underline"
                >
                  {r.company_name || '(unnamed)'}
                </Link>
                <div className="text-xs text-gray-500">{r.contact_email || '—'}</div>
              </div>
              <div className="text-right text-xs text-gray-500">
                {r.subscription_plan ?? '—'}
                {r.current_period_end && (
                  <div>{new Date(r.current_period_end).toLocaleDateString()}</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
