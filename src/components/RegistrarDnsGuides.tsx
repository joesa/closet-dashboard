'use client'

import React, { useMemo, useState } from 'react'
import {
  REGISTRAR_DNS_GUIDES,
  type RegistrarGuideId,
} from '@/lib/domains/registrarGuides'
import type { DnsInstruction } from '@/lib/domains/types'

type Props = {
  /** Optional live records from Vercel attach — shown above the guide. */
  records?: DnsInstruction[]
  variant?: 'dark' | 'light'
  className?: string
}

/**
 * Tabbed DNS how-to for popular registrars. Same A/CNAME targets everywhere —
 * we never call GoDaddy/Namecheap APIs.
 */
export default function RegistrarDnsGuides({
  records,
  variant = 'dark',
  className = '',
}: Props) {
  const [active, setActive] = useState<RegistrarGuideId>('godaddy')
  const guide = useMemo(
    () => REGISTRAR_DNS_GUIDES.find((g) => g.id === active) || REGISTRAR_DNS_GUIDES[0],
    [active]
  )

  const isDark = variant === 'dark'
  const tabIdle = isDark
    ? 'border-white/10 text-zinc-400 hover:text-white'
    : 'border-zinc-200 text-zinc-500 hover:text-zinc-900'
  const tabActive = isDark
    ? 'border-indigo-400 text-indigo-200 bg-indigo-500/10'
    : 'border-indigo-500 text-indigo-700 bg-indigo-50'
  const panel = isDark
    ? 'border-white/10 bg-black/20 text-zinc-300'
    : 'border-zinc-200 bg-zinc-50 text-zinc-700'
  const mono = isDark ? 'bg-black/40 text-zinc-200' : 'bg-white text-zinc-800 border border-zinc-200'

  return (
    <div className={`space-y-3 ${className}`}>
      <div>
        <p
          className={`text-xs font-bold uppercase tracking-wider ${
            isDark ? 'text-zinc-500' : 'text-zinc-500'
          }`}
        >
          DNS setup by registrar
        </p>
        <p className={`mt-1 text-xs ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
          Point your domain at our hosting with the records below. Pick your registrar for
          click-path help — you stay the owner of the domain.
        </p>
      </div>

      {records && records.length > 0 && (
        <div className={`rounded-lg border p-3 ${panel}`}>
          <p className="text-xs font-semibold mb-2">Records to add</p>
          <div className="space-y-1.5">
            {records.map((ins, i) => (
              <div
                key={i}
                className={`grid grid-cols-[4rem_3rem_1fr] gap-2 rounded px-2 py-1.5 text-xs font-mono ${mono}`}
              >
                <span>{ins.type}</span>
                <span>{ins.name}</span>
                <span className="truncate" title={ins.value}>
                  {ins.value}
                </span>
              </div>
            ))}
          </div>
          {records[0]?.reason && (
            <p className={`mt-2 text-[11px] ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
              {records[0].reason}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {REGISTRAR_DNS_GUIDES.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setActive(g.id)}
            className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
              active === g.id ? tabActive : tabIdle
            }`}
          >
            {g.name}
          </button>
        ))}
      </div>

      <div className={`rounded-lg border p-3 ${panel}`}>
        <ol className="list-decimal space-y-2 pl-4 text-xs leading-relaxed">
          {guide.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {guide.helpUrl && (
          <a
            href={guide.helpUrl}
            target="_blank"
            rel="noreferrer"
            className={`mt-3 inline-block text-xs font-medium ${
              isDark ? 'text-indigo-300 hover:text-indigo-200' : 'text-indigo-600 hover:underline'
            }`}
          >
            Official {guide.name} DNS help →
          </a>
        )}
      </div>
    </div>
  )
}
