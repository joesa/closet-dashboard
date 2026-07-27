'use client'

import { useState, type ReactNode } from 'react'

type Props = {
  title: string
  /** Shown under the title when collapsed (one line). */
  summary?: string
  badge?: ReactNode
  /** Extra controls on the header row (kept visible when collapsed). */
  headerRight?: ReactNode
  borderClassName?: string
  titleClassName?: string
  /** Default false — site details cards start collapsed. */
  defaultOpen?: boolean
  children: ReactNode
}

/**
 * Admin site-details card shell. Collapsed by default so landing on
 * /admin/sites/[id] stays scannable; expand a section to work in it.
 * Body stays mounted (hidden) so background polls (e.g. Full redesign) continue.
 */
export default function AdminCollapsibleCard({
  title,
  summary,
  badge,
  headerRight,
  borderClassName = 'border-neutral-800',
  titleClassName = 'text-neutral-500',
  defaultOpen = false,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section
      className={`bg-neutral-900 border ${borderClassName} rounded-xl overflow-hidden`}
    >
      <div className="flex items-start justify-between gap-3 px-6 py-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="min-w-0 flex-1 text-left hover:opacity-90 transition-opacity"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-neutral-500 text-sm w-4 shrink-0" aria-hidden>
              {open ? '▾' : '▸'}
            </span>
            <h3
              className={`text-xs font-bold uppercase tracking-widest ${titleClassName}`}
            >
              {title}
            </h3>
            {badge}
          </div>
          {summary && !open ? (
            <p className="mt-1 ml-4 text-sm text-neutral-500 line-clamp-2">{summary}</p>
          ) : null}
        </button>
        {headerRight ? (
          <div className="flex items-center gap-2 shrink-0 pt-0.5">{headerRight}</div>
        ) : null}
      </div>
      <div className={open ? 'px-6 pb-6 space-y-4' : 'hidden'}>{children}</div>
    </section>
  )
}
