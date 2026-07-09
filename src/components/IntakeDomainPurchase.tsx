'use client'

import React, { useState } from 'react'

type Props = {
  intakeId: string
  desiredDomain: string | null
  tenantId: string | null
}

/**
 * Admin intake detail: show prospect-selected domain and purchase via Vercel
 * after the site tenant exists.
 */
export default function IntakeDomainPurchase({ intakeId, desiredDomain, tenantId }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  if (!desiredDomain) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Desired domain
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Prospect did not select a custom domain. They will use the platform subdomain unless
          you add one later on the site detail page.
        </p>
      </div>
    )
  }

  const purchase = async () => {
    if (!tenantId) {
      setError('Provision the site first, then purchase the domain.')
      return
    }
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/domains/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: desiredDomain, tenantId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Purchase failed')
      setSuccess(
        `Registered ${json.domain?.hostname || desiredDomain}. ${json.billingNote || 'Included with hosting.'}`
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Purchase failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Desired domain
      </h2>
      <p className="text-lg font-medium text-gray-900">{desiredDomain}</p>
      <p className="text-xs text-gray-500">
        Prospect selected this during intake. Purchase registers it via Vercel (platform cost
        folded into maintenance) and maps it to their site.
      </p>
      {!tenantId && (
        <p className="text-sm text-amber-800 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          Site not provisioned yet — open onboarding / build first, then return here to purchase.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-700">{success}</p>}
      <button
        type="button"
        disabled={busy || !tenantId}
        onClick={() => void purchase()}
        className="w-full rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50"
      >
        {busy ? 'Purchasing…' : `Purchase ${desiredDomain}`}
      </button>
      <p className="text-[11px] text-gray-400">Intake id: {intakeId}</p>
    </div>
  )
}
