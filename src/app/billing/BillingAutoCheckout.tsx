'use client'

import { useEffect, useRef, useState } from 'react'

type Plan = 'monthly' | 'yearly'

export default function BillingAutoCheckout({
  enabled,
  plan,
}: {
  enabled: boolean
  plan: Plan
}) {
  const started = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled || started.current) return
    started.current = true
    setLoading(true)

    void (async () => {
      try {
        const res = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan, skipTrial: true }),
        })
        const data = (await res.json()) as { url?: string; error?: string }
        if (!res.ok || !data.url) {
          setError(data.error || 'Could not start checkout.')
          setLoading(false)
          started.current = false
          return
        }
        window.location.href = data.url
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Network error.')
        setLoading(false)
        started.current = false
      }
    })()
  }, [enabled, plan])

  if (!enabled) return null

  return (
    <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center text-sm text-slate-300">
      {loading && !error && <p>Redirecting to secure checkout…</p>}
      {error && <p className="text-amber-300">{error} Use the buttons below to try again.</p>}
    </div>
  )
}
