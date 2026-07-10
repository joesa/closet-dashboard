'use client'

import React, { useState } from 'react'
import Link from 'next/link'

export type DesiredDomainStatus = {
  hostname: string
  source: string
  isPrimary: boolean
  vercelVerified: boolean
  registrarOrderId: string | null
  purchasePriceCents: number | null
} | null

type Props = {
  intakeId: string
  desiredDomain: string | null
  /** Prospect opted into platform purchase during intake. */
  purchaseRequested: boolean
  tenantId: string | null
  /** Existing domains row for this hostname on the tenant, if any. */
  existingDomain: DesiredDomainStatus
}

/**
 * Admin intake detail: BYO is default. Purchase only when the prospect
 * checked “purchase for me” (or admin overrides after provision).
 */
export default function IntakeDomainPurchase({
  intakeId,
  desiredDomain,
  purchaseRequested,
  tenantId,
  existingDomain,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [purchased, setPurchased] = useState(
    existingDomain?.source === 'purchased' && Boolean(existingDomain.registrarOrderId)
  )

  if (!desiredDomain) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Website domain
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Prospect did not enter a domain. They will use the platform subdomain until they connect
          a BYO domain from the site detail page (Domain Manager).
        </p>
      </div>
    )
  }

  const alreadyPurchased =
    purchased ||
    (existingDomain?.source === 'purchased' && Boolean(existingDomain.registrarOrderId))
  const stalePurchaseMarker =
    existingDomain?.source === 'purchased' && !existingDomain.registrarOrderId
  const legacyPlaceholder = existingDomain?.source === 'byo' && !existingDomain.registrarOrderId
  const isByoIntent = !purchaseRequested

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
      setPurchased(true)
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
        Website domain
      </h2>
      <p className="text-lg font-medium text-gray-900">{desiredDomain}</p>

      {isByoIntent ? (
        <div className="space-y-2">
          <p className="text-sm text-sky-900 rounded-md border border-sky-200 bg-sky-50 px-3 py-2">
            <span className="font-semibold">BYO (default).</span> Prospect will keep this domain at
            their registrar. After the site is provisioned, connect it in Domain Manager and follow
            the GoDaddy / Namecheap / Cloudflare / Hostinger DNS guides.
          </p>
          {tenantId && (
            <Link
              href={`/admin/sites/${tenantId}`}
              className="inline-block text-sm font-medium text-indigo-600 hover:underline"
            >
              Open site → Domain Manager to connect BYO →
            </Link>
          )}
          <p className="text-xs text-gray-500">
            You can still purchase via Vercel below if they later ask you to handle registration
            (optional override).
          </p>
        </div>
      ) : (
        <p className="text-sm text-violet-900 rounded-md border border-violet-200 bg-violet-50 px-3 py-2">
          <span className="font-semibold">Purchase requested.</span> Prospect asked us to register
          this domain and fold cost into hosting. Purchase after the site tenant exists.
        </p>
      )}

      {!tenantId && purchaseRequested && (
        <p className="text-sm text-amber-800 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          Site not provisioned yet — open onboarding / build first, then return here to purchase.
        </p>
      )}
      {alreadyPurchased && (
        <p className="text-sm text-emerald-800 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
          Domain is purchased and connected
          {existingDomain?.registrarOrderId ? ` (order ${existingDomain.registrarOrderId})` : ''}.
        </p>
      )}
      {stalePurchaseMarker && !purchased && (
        <p className="text-sm text-amber-800 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          A previous purchase attempt was recorded without a completed Vercel order. You can retry
          purchase after billing is fixed.
        </p>
      )}
      {legacyPlaceholder && !alreadyPurchased && (
        <p className="text-sm text-amber-800 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          A BYO placeholder row already exists for this hostname. Prefer Domain Manager DNS setup,
          or purchase to upgrade it to a Vercel-registered domain.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-700">{success}</p>}

      {(purchaseRequested || !isByoIntent || Boolean(tenantId)) && !alreadyPurchased && (
        <button
          type="button"
          disabled={busy || !tenantId || alreadyPurchased}
          onClick={() => void purchase()}
          className="w-full rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-50"
        >
          {busy
            ? 'Purchasing…'
            : purchaseRequested
              ? `Purchase ${desiredDomain}`
              : `Override: purchase ${desiredDomain} for them`}
        </button>
      )}
      {alreadyPurchased && (
        <button
          type="button"
          disabled
          className="w-full rounded-md bg-violet-700 px-4 py-2 text-sm font-medium text-white opacity-50"
        >
          Already purchased
        </button>
      )}
      <p className="text-[11px] text-gray-400">Intake id: {intakeId}</p>
    </div>
  )
}
