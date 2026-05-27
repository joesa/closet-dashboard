'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'

type Plan = 'monthly' | 'yearly'

const FEATURES = [
  'Interactive quote widget',
  'Unlimited lead capture (SMS + email)',
  'Custom room & finish pricing',
  'Dynamic add-on manager',
]

export default function BillingActions({
  isActive,
  currentPlan,
  currentPeriodEnd,
}: {
  isActive: boolean
  currentPlan: Plan | null
  currentPeriodEnd: string | null
}) {
  const [plan, setPlan] = useState<Plan>(currentPlan ?? 'monthly')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upgrade() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setError(data.error || 'Could not start checkout.')
        setLoading(false)
        return
      }
      window.location.href = data.url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error.')
      setLoading(false)
    }
  }

  async function openPortal() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setError(data.error || 'Could not open billing portal.')
        setLoading(false)
        return
      }
      window.location.href = data.url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error.')
      setLoading(false)
    }
  }

  if (isActive) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.04] px-5 py-4">
          <p className="text-sm font-semibold text-emerald-300">
            Subscription active{currentPlan ? ` · ${currentPlan === 'yearly' ? 'Yearly' : 'Monthly'}` : ''}
          </p>
          {currentPeriodEnd && (
            <p className="mt-1 text-xs text-emerald-200/70">
              Renews {new Date(currentPeriodEnd).toLocaleDateString(undefined, {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={openPortal}
          disabled={loading}
          className="w-full rounded-lg bg-white px-6 py-3 text-base font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-50"
        >
          {loading ? 'Opening…' : 'Manage subscription'}
        </button>
        {error && <p className="text-center text-sm text-red-400">{error}</p>}
      </div>
    )
  }

  const monthlyAmount = 99
  const yearlyAmount = 990
  const display = plan === 'monthly' ? monthlyAmount : Math.round(yearlyAmount / 12)
  const sub = plan === 'monthly' ? '/month' : '/month, billed yearly'

  return (
    <div className="space-y-6">
      {/* Plan toggle */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
          <button
            type="button"
            onClick={() => setPlan('monthly')}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
              plan === 'monthly' ? 'bg-white text-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setPlan('yearly')}
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition ${
              plan === 'yearly' ? 'bg-white text-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            Yearly
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                plan === 'yearly'
                  ? 'bg-black/10 text-black'
                  : 'bg-emerald-400/10 text-emerald-300'
              }`}
            >
              Save $198
            </span>
          </button>
        </div>
      </div>

      {/* Price */}
      <div className="text-center">
        <div className="flex items-baseline justify-center gap-2">
          <span className="text-5xl font-bold tracking-tighter text-white">${display}</span>
          <span className="text-sm text-slate-400">{sub}</span>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {plan === 'yearly'
            ? `$${yearlyAmount} billed once a year.`
            : 'Billed monthly. Cancel anytime.'}
        </p>
      </div>

      <ul className="space-y-2">
        {FEATURES.map((f) => (
          <li key={f} className="flex items-center gap-3 text-sm text-slate-300">
            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
              <Check className="h-3 w-3 text-white" strokeWidth={3} />
            </span>
            {f}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={upgrade}
        disabled={loading}
        className="w-full rounded-lg bg-white px-6 py-3 text-base font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-50"
      >
        {loading ? 'Redirecting to Stripe…' : 'Upgrade to Pro'}
      </button>
      {error && <p className="text-center text-sm text-red-400">{error}</p>}
    </div>
  )
}
