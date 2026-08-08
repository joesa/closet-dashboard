'use client'

import { useState } from 'react'

type SiteOption = { id: string; businessName: string; status: string }
type BatchResult = { tenantId: string; businessName?: string; status: 'queued' | 'skipped' | 'failed'; message: string }

export default function BatchFullRedesign({ sites }: { sites: SiteOption[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<BatchResult[]>([])
  const eligible = sites.filter((site) => site.status !== 'widget_only')

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const queue = async () => {
    if (selected.size === 0 || running) return
    if (!window.confirm(`Queue Full Redesign for ${selected.size} selected site${selected.size === 1 ? '' : 's'}?`)) return
    setRunning(true)
    setResults([])
    try {
      const response = await fetch('/api/admin/sites/custom-build/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantIds: [...selected] }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || 'Batch queue failed')
      setResults(json.results || [])
      setSelected(new Set())
    } catch (error) {
      setResults([{ tenantId: '', status: 'failed', message: error instanceof Error ? error.message : 'Batch queue failed' }])
    } finally {
      setRunning(false)
    }
  }

  return (
    <section className="mb-8 border border-neutral-800 bg-neutral-900 p-5" aria-labelledby="batch-redesign-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="batch-redesign-title" className="text-lg font-semibold">Batch Full Redesign</h2>
          <p className="mt-1 text-sm text-neutral-400">Select up to 20 existing sites. Active jobs are skipped automatically.</p>
        </div>
        <button
          type="button"
          onClick={queue}
          disabled={selected.size === 0 || running}
          className="bg-white px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          {running ? 'Queueing…' : `Queue selected (${selected.size})`}
        </button>
      </div>
      <div className="mt-4 grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
        {eligible.map((site) => (
          <label key={site.id} className="flex cursor-pointer items-center gap-3 border border-neutral-800 px-3 py-2 text-sm hover:border-neutral-600">
            <input
              type="checkbox"
              checked={selected.has(site.id)}
              disabled={!selected.has(site.id) && selected.size >= 20}
              onChange={() => toggle(site.id)}
              className="h-4 w-4 accent-white"
            />
            <span className="truncate">{site.businessName}</span>
          </label>
        ))}
      </div>
      {results.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm" aria-live="polite">
          {results.map((result, index) => (
            <li key={`${result.tenantId}-${index}`} className={result.status === 'failed' ? 'text-red-400' : result.status === 'queued' ? 'text-emerald-400' : 'text-amber-400'}>
              {result.businessName || result.tenantId || 'Batch'}: {result.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}