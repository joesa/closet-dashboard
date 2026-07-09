'use client'

import React, { useState } from 'react'

export type DomainSuggestionHit = {
  domain: string
  available: boolean
  priceUsd: number | null
  priceCents: number | null
  error?: string
}

type Props = {
  /** Currently selected domain (desired or purchased). */
  value: string
  onChange: (domain: string) => void
  /** Seed search from business name when empty. */
  businessNameHint?: string
  /**
   * How to search:
   * - intake: POST /api/intake/{token}/suggest-domains
   * - admin: POST /api/domains/search (admin session; tenantId optional)
   */
  mode: 'intake' | 'admin'
  intakeToken?: string
  tenantId?: string
  /** Compact dark styling for admin sandbox. */
  variant?: 'light' | 'dark'
  className?: string
}

/**
 * Suggests available .com/.net/.io domains via Vercel Registrar availability
 * and lets the user pick one. Does not purchase — selection is stored for
 * admin purchase after intake / during sandbox provisioning.
 */
export default function DomainSuggestPicker({
  value,
  onChange,
  businessNameHint = '',
  mode,
  intakeToken,
  tenantId,
  variant = 'light',
  className = '',
}: Props) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<DomainSuggestionHit[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  const isDark = variant === 'dark'
  const inputClass = isDark
    ? 'w-full bg-neutral-900 border border-neutral-700 rounded-md p-3 text-white text-sm'
    : 'mt-1 w-full rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-zinc-500'
  const btnClass = isDark
    ? 'shrink-0 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md text-sm font-bold disabled:opacity-50'
    : 'shrink-0 rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200 disabled:opacity-50'
  const hitClass = isDark
    ? 'flex flex-wrap items-center justify-between gap-2 rounded-md border border-neutral-700 px-3 py-2'
    : 'flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/10 px-3 py-2'
  const pickClass = isDark
    ? 'text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-md disabled:opacity-40'
    : 'text-xs font-semibold rounded-md bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 px-3 py-1.5 hover:bg-emerald-500/30 disabled:opacity-40'

  const runSearch = async () => {
    const q = query.trim() || businessNameHint.trim()
    if (!q) {
      setError('Enter a business name or domain to search.')
      return
    }
    setBusy(true)
    setError('')
    setSearched(true)
    try {
      let res: Response
      if (mode === 'intake') {
        if (!intakeToken) throw new Error('Missing intake token')
        res = await fetch(`/api/intake/${intakeToken}/suggest-domains`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q, businessName: businessNameHint }),
        })
      } else {
        res = await fetch('/api/domains/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: q,
            ...(tenantId ? { tenantId } : {}),
            allowWithoutTenant: true,
          }),
        })
      }
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Search failed')
      setHits(Array.isArray(json.suggestions) ? json.suggestions : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
      setHits([])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          className={inputClass}
          placeholder={businessNameHint ? `e.g. ${businessNameHint}` : 'business name or example.com'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void runSearch()
            }
          }}
          disabled={busy}
        />
        <button type="button" className={btnClass} disabled={busy} onClick={() => void runSearch()}>
          {busy ? 'Checking…' : 'Check availability'}
        </button>
      </div>

      {error && (
        <p className={isDark ? 'text-xs text-red-300' : 'text-xs text-red-400'}>{error}</p>
      )}

      {value && (
        <p className={isDark ? 'text-sm text-emerald-300' : 'text-sm text-emerald-300'}>
          Selected: <strong>{value}</strong>
          <button
            type="button"
            className="ml-2 text-xs underline opacity-70 hover:opacity-100"
            onClick={() => onChange('')}
          >
            Clear
          </button>
        </p>
      )}

      {searched && hits.length === 0 && !busy && !error && (
        <p className={isDark ? 'text-xs text-neutral-400' : 'text-xs text-zinc-500'}>
          No suggestions — try a different name.
        </p>
      )}

      {hits.length > 0 && (
        <ul className="space-y-2">
          {hits.map((hit) => {
            const selected = value.toLowerCase() === hit.domain.toLowerCase()
            return (
              <li key={hit.domain} className={hitClass}>
                <div>
                  <span className={isDark ? 'text-sm text-white font-medium' : 'text-sm text-white font-medium'}>
                    {hit.domain}
                  </span>
                  <span className={isDark ? 'ml-2 text-xs text-neutral-400' : 'ml-2 text-xs text-zinc-500'}>
                    {hit.available
                      ? hit.priceUsd != null
                        ? `Available`
                        : 'Available'
                      : 'Taken'}
                  </span>
                </div>
                <button
                  type="button"
                  className={pickClass}
                  disabled={!hit.available || selected}
                  onClick={() => onChange(hit.domain)}
                >
                  {selected ? 'Selected' : hit.available ? 'Choose' : 'Unavailable'}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <p className={isDark ? 'text-[11px] text-neutral-500' : 'text-[11px] text-zinc-500'}>
        Availability is checked live with Vercel. Choosing a domain saves it for registration —
        purchase is completed by the team after your site is set up (included with hosting).
      </p>
    </div>
  )
}
