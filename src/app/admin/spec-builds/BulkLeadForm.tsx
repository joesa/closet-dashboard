'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { QueueLeadOutcome } from '@/app/api/admin/spec-builds/route'

type Row = {
  businessName: string
  phone: string
  services: string
  city: string
  email: string
  socialProfileUrl: string
}

const BLANK: Row = {
  businessName: '',
  phone: '',
  services: '',
  city: '',
  email: '',
  socialProfileUrl: '',
}

const OUTCOME_STYLE: Record<QueueLeadOutcome['status'], string> = {
  queued: 'text-emerald-700',
  duplicate: 'text-amber-700',
  invalid_phone: 'text-red-700',
  missing_name: 'text-red-700',
  error: 'text-red-700',
}

/**
 * Hand-found lead entry — the "saw a yard sign" case.
 *
 * Pasting is the fast path: someone with a list in a notes app should not have
 * to tab through six fields per lead. Rows are submitted and reported on
 * individually so one bad phone number cannot discard the rest of a paste.
 */
export default function BulkLeadForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Row[]>([{ ...BLANK }])
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState<QueueLeadOutcome[] | null>(null)
  const [error, setError] = useState('')

  const set = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const parsePaste = (text: string) => {
    // "Business, phone, services" per line — the order the fields are shown in.
    const parsed = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [businessName = '', phone = '', ...rest] = line.split(/\t|,(?=\s*[^,]*$)|,/)
        return {
          ...BLANK,
          businessName: businessName.trim(),
          phone: phone.trim(),
          services: rest.join(', ').trim(),
        }
      })
    if (parsed.length > 0) setRows(parsed)
  }

  const submit = async () => {
    setSubmitting(true)
    setError('')
    setResults(null)
    try {
      const res = await fetch('/api/admin/spec-builds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads: rows }),
      })
      const text = await res.text()
      let json: { results?: QueueLeadOutcome[]; queuedCount?: number; error?: string } = {}
      try {
        json = JSON.parse(text)
      } catch {
        throw new Error(`Server returned an unreadable response (${res.status}).`)
      }
      if (!res.ok) throw new Error(json.error || `Failed to queue (${res.status}).`)

      setResults(json.results ?? [])
      if ((json.queuedCount ?? 0) > 0) {
        setRows([{ ...BLANK }])
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to queue leads.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
      >
        Add leads by hand
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Add leads by hand
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Business name and phone are required. Everything else improves the build — the
            Facebook page in particular, since it is the best source of real, verifiable facts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Close
        </button>
      </div>

      <textarea
        placeholder="Paste one lead per line: Business name, phone, services"
        onPaste={(e) => {
          const text = e.clipboardData.getData('text')
          if (text.includes('\n')) {
            e.preventDefault()
            parsePaste(text)
          }
        }}
        className="mb-4 w-full rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm"
        rows={2}
      />

      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 md:grid-cols-6">
            <input
              value={row.businessName}
              onChange={(e) => set(i, { businessName: e.target.value })}
              placeholder="Business name *"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm md:col-span-2"
            />
            <input
              value={row.phone}
              onChange={(e) => set(i, { phone: e.target.value })}
              placeholder="Phone *"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
            <input
              value={row.services}
              onChange={(e) => set(i, { services: e.target.value })}
              placeholder="Services (comma separated)"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
            <input
              value={row.city}
              onChange={(e) => set(i, { city: e.target.value })}
              placeholder="City"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
            <input
              value={row.socialProfileUrl}
              onChange={(e) => set(i, { socialProfileUrl: e.target.value })}
              placeholder="Facebook URL"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, { ...BLANK }])}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Add another
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={submitting}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {submitting ? 'Queueing…' : `Queue ${rows.length} lead${rows.length === 1 ? '' : 's'}`}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {results && results.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm">
          {results.map((result, i) => (
            <li key={i} className={OUTCOME_STYLE[result.status]}>
              <span className="font-medium">{result.businessName || result.phone || 'Row'}</span>
              {' — '}
              {result.status === 'queued' ? 'queued' : result.message || result.status}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
