'use client'

import React, { useCallback, useEffect, useState } from 'react'
import type { DomainRow, DnsInstruction } from '@/lib/domains/types'
import { defaultByoDnsInstructions } from '@/lib/domains/types'
import RegistrarDnsGuides from '@/components/RegistrarDnsGuides'

type SearchHit = {
  domain: string
  available: boolean
  priceUsd: number | null
  priceCents: number | null
  error?: string
}

type Props = {
  /** When set (admin site detail), scopes all API calls to this tenant. */
  tenantId?: string
  /** Show wholesale cost / order ids (admin). Also unlocks optional purchase UI. */
  showAdminCost?: boolean
  /** Compact styling for embedding in dark admin pages. */
  variant?: 'dashboard' | 'admin'
}

function statusBadge(domain: DomainRow) {
  if (domain.source === 'platform_subdomain') {
    return { label: 'Platform', className: 'bg-neutral-700 text-neutral-200' }
  }
  if (domain.vercel_verified || domain.ssl_status === 'active') {
    return { label: 'Active', className: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' }
  }
  if (domain.ssl_status === 'pending') {
    return { label: 'Pending DNS', className: 'bg-amber-500/15 text-amber-300 border border-amber-500/30' }
  }
  return { label: domain.ssl_status || 'Unknown', className: 'bg-red-500/15 text-red-300 border border-red-500/30' }
}

function publicUrl(hostname: string) {
  const isLocal = hostname.endsWith('.localhost') || hostname === 'localhost'
  return isLocal ? `http://${hostname}:3000` : `https://${hostname}`
}

export default function DomainManager({ tenantId, showAdminCost = false, variant = 'dashboard' }: Props) {
  const [domains, setDomains] = useState<DomainRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [byoInput, setByoInput] = useState('')
  const [byoBusy, setByoBusy] = useState(false)
  const [dnsByDomain, setDnsByDomain] = useState<Record<string, DnsInstruction[]>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [searchHits, setSearchHits] = useState<SearchHit[]>([])
  const [searchBusy, setSearchBusy] = useState(false)
  const [purchaseBusy, setPurchaseBusy] = useState<string | null>(null)
  const [purchaseEnabled, setPurchaseEnabled] = useState(false)
  const [noSite, setNoSite] = useState(false)

  const bodyTenant = tenantId ? { tenantId } : {}

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    setNoSite(false)
    try {
      const qs = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''
      const res = await fetch(`/api/domains${qs}`)
      const json = await res.json()
      if (res.status === 404) {
        setNoSite(true)
        setDomains([])
        return
      }
      if (!res.ok) throw new Error(json.error || 'Failed to load domains')
      setDomains(Array.isArray(json.domains) ? json.domains : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load domains')
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const attachByo = async () => {
    setByoBusy(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/domains/byo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostname: byoInput, ...bodyTenant }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Attach failed')
      setMessage(`Connected ${json.domain.hostname}. Update DNS at your registrar, then click Check DNS.`)
      if (json.domain?.id && Array.isArray(json.dnsInstructions)) {
        setDnsByDomain((prev) => ({ ...prev, [json.domain.id]: json.dnsInstructions }))
      }
      setByoInput('')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Attach failed')
    } finally {
      setByoBusy(false)
    }
  }

  const checkDns = async (domainId: string) => {
    setError('')
    setMessage('')
    try {
      const res = await fetch(`/api/domains/${domainId}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyTenant),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Check failed')
      if (Array.isArray(json.dnsInstructions)) {
        setDnsByDomain((prev) => ({ ...prev, [domainId]: json.dnsInstructions }))
      }
      setMessage(
        json.verified
          ? `${json.domain.hostname} is verified and live.`
          : `Still waiting on DNS for ${json.domain.hostname}.`
      )
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Check failed')
    }
  }

  const makePrimary = async (domainId: string) => {
    setError('')
    try {
      const res = await fetch(`/api/domains/${domainId}/make-primary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyTenant),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Update failed')
      setMessage(`${json.domain.hostname} is now the primary domain.`)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    }
  }

  const runSearch = async () => {
    setSearchBusy(true)
    setError('')
    try {
      const res = await fetch('/api/domains/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, ...bodyTenant }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Search failed')
      setSearchHits(Array.isArray(json.suggestions) ? json.suggestions : [])
      setPurchaseEnabled(json.purchaseEnabled === true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setSearchBusy(false)
    }
  }

  const purchase = async (domain: string) => {
    setPurchaseBusy(domain)
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/domains/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, ...bodyTenant }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Purchase failed')
      setMessage(
        `Registered ${json.domain.hostname}. ${json.billingNote || 'Included with hosting.'}`
      )
      setSearchHits([])
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Purchase failed')
    } finally {
      setPurchaseBusy(null)
    }
  }

  const shell =
    variant === 'admin'
      ? 'rounded-xl border border-neutral-700 bg-neutral-900/60 p-6 space-y-6'
      : 'rounded-2xl border border-white/[0.06] bg-[#12151C] p-8 space-y-6'

  const inputClass =
    variant === 'admin'
      ? 'w-full bg-neutral-950 border border-neutral-700 rounded-md p-3 text-white text-sm'
      : 'w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white'

  const btnPrimary =
    variant === 'admin'
      ? 'bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md text-sm font-bold disabled:opacity-50'
      : 'rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50'

  const btnSecondary =
    variant === 'admin'
      ? 'border border-neutral-600 hover:border-neutral-400 text-white px-3 py-1.5 rounded-md text-xs font-bold disabled:opacity-50'
      : 'rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/5 disabled:opacity-50'

  if (loading) {
    return (
      <div className={shell}>
        <p className="text-sm text-neutral-400 animate-pulse">Loading domains…</p>
      </div>
    )
  }

  if (noSite) {
    return (
      <div className={shell}>
        <h2 className="text-xl font-semibold tracking-tight text-white">Custom domain</h2>
        <p className="text-sm text-zinc-400">
          Domain management is available after your full website is provisioned. Your platform
          subdomain will appear here once the site is live.
        </p>
      </div>
    )
  }

  return (
    <div className={shell}>
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-white">Website domains</h2>
        <p className="text-sm text-zinc-400 mt-1">
          Connect a domain you already own, or let us register a .com / .net / .io for you
          (included with hosting).
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200">
          {message}
        </div>
      )}

      {/* Current domains */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500">Current</h3>
        {domains.length === 0 ? (
          <p className="text-sm text-zinc-500">No domains on file yet.</p>
        ) : (
          domains.map((d) => {
            const badge = statusBadge(d)
            const instructions = dnsByDomain[d.id]
            return (
              <div
                key={d.id}
                className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href={publicUrl(d.hostname)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-white hover:underline"
                      >
                        {d.hostname}
                      </a>
                      {d.is_primary && (
                        <span className="text-[10px] uppercase tracking-wide text-indigo-300">
                          Primary
                        </span>
                      )}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${badge.className}`}>
                        {badge.label}
                      </span>
                      {d.source === 'purchased' && (
                        <span className="text-[10px] uppercase tracking-wide text-violet-300">
                          Purchased
                        </span>
                      )}
                      {d.source === 'byo' && (
                        <span className="text-[10px] uppercase tracking-wide text-sky-300">BYO</span>
                      )}
                    </div>
                    {d.status_message && (
                      <p className="text-xs text-zinc-500 mt-1">{d.status_message}</p>
                    )}
                    {showAdminCost && d.source === 'purchased' && (
                      <p className="text-xs text-amber-200/80 mt-1">
                        Platform cost:{' '}
                        {d.purchase_price_cents != null
                          ? `$${(d.purchase_price_cents / 100).toFixed(2)}/yr`
                          : '—'}{' '}
                        — covered by maintenance
                        {d.registrar_order_id ? ` · order ${d.registrar_order_id}` : ''}
                        {d.expires_at
                          ? ` · renews ${new Date(d.expires_at).toLocaleDateString('en-US', {
                              timeZone: 'UTC',
                              dateStyle: 'medium',
                            })} UTC`
                          : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {d.source !== 'platform_subdomain' && (
                      <button type="button" className={btnSecondary} onClick={() => void checkDns(d.id)}>
                        Check DNS
                      </button>
                    )}
                    {!d.is_primary && (
                      <button
                        type="button"
                        className={btnSecondary}
                        onClick={() => void makePrimary(d.id)}
                      >
                        Make primary
                      </button>
                    )}
                  </div>
                </div>

                {d.source === 'byo' && (
                  <RegistrarDnsGuides
                    variant="dark"
                    records={
                      instructions && instructions.length > 0
                        ? instructions
                        : defaultByoDnsInstructions(d.hostname)
                    }
                  />
                )}

                {d.source === 'purchased' && d.nameservers && d.nameservers.length > 0 && (
                  <div className="rounded-lg bg-black/30 border border-white/5 p-3">
                    <p className="text-xs font-bold text-zinc-400 mb-2">Vercel nameservers</p>
                    <ul className="text-xs font-mono text-zinc-300 space-y-1">
                      {d.nameservers.map((ns) => (
                        <li key={ns}>{ns}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* BYO — default path */}
      <div className="space-y-3 border-t border-white/10 pt-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500">
          Connect your domain (recommended)
        </h3>
        <p className="text-xs text-zinc-500">
          Enter a domain you already own. We attach it to your site; you keep ownership at GoDaddy,
          Namecheap, Cloudflare, Hostinger, or any other registrar. Use the guides below after
          connecting.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            className={inputClass}
            placeholder="example.com"
            value={byoInput}
            onChange={(e) => setByoInput(e.target.value)}
            disabled={byoBusy}
          />
          <button
            type="button"
            className={btnPrimary}
            disabled={byoBusy || !byoInput.trim()}
            onClick={() => void attachByo()}
          >
            {byoBusy ? 'Connecting…' : 'Connect domain'}
          </button>
        </div>
        <RegistrarDnsGuides variant="dark" records={defaultByoDnsInstructions('yourdomain.com')} />
      </div>

      {/* Purchase — admin optional only */}
      {showAdminCost && (
        <div className="space-y-3 border-t border-white/10 pt-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-500">
            Optional: register a domain for them
          </h3>
          <p className="text-xs text-zinc-500">
            Admin only. Buy via Vercel Registrar when the customer checked “purchase for me” or
            needs a turnkey domain. Cost folds into maintenance — prefer BYO when they already own
            a name.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              className={inputClass}
              placeholder="business name or desired domain"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={searchBusy}
            />
            <button
              type="button"
              className={btnPrimary}
              disabled={searchBusy || !searchQuery.trim()}
              onClick={() => void runSearch()}
            >
              {searchBusy ? 'Searching…' : 'Search'}
            </button>
          </div>

          {searchHits.length > 0 && (
            <div className="space-y-2">
              {!purchaseEnabled && (
                <p className="text-xs text-amber-300">
                  Domain purchase is disabled in this environment (DOMAIN_PURCHASE_ENABLED). Search
                  still shows availability.
                </p>
              )}
              {searchHits.map((hit) => (
                <div
                  key={hit.domain}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 px-4 py-3"
                >
                  <div>
                    <span className="text-sm text-white font-medium">{hit.domain}</span>
                    <span className="ml-2 text-xs text-zinc-500">
                      {hit.available
                        ? hit.priceUsd != null
                          ? `Available · ~$${hit.priceUsd.toFixed(2)}/yr wholesale`
                          : 'Available'
                        : 'Unavailable'}
                    </span>
                  </div>
                  {hit.available && (
                    <button
                      type="button"
                      className={btnPrimary}
                      disabled={!purchaseEnabled || purchaseBusy === hit.domain}
                      onClick={() => void purchase(hit.domain)}
                    >
                      {purchaseBusy === hit.domain ? 'Registering…' : 'Register for them'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
