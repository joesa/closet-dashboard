'use client'

import { useMemo, useState } from 'react'

type ConfigHistoryRow = {
  id: number
  changed_by_email: string | null
  change_note: string | null
  created_at: string
}

type RunEventRow = {
  id: number
  run_id: string | null
  phase: string
  created_at: string
  payload: Record<string, unknown> | null
}

type CityLedgerRow = {
  city_key: string
  city_label: string
  run_count: number
  last_scraped_at: string
  last_run_id: string | null
}

type RunResultRow = {
  run_id: string
  phase: string
  lead_count: number
  selected_cities: string[] | null
  target_locations: string[] | null
  created_at: string
}

function payloadText(payload: Record<string, unknown> | null, key: string): string {
  if (!payload) return '—'
  const value = payload[key]
  if (typeof value === 'string') return value.trim() || '—'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return '—'
}

export default function ScraperInsightsPanels({
  history,
  runEvents,
  runResults,
  cityLedger,
}: {
  history: ConfigHistoryRow[]
  runEvents: RunEventRow[]
  runResults: RunResultRow[]
  cityLedger: CityLedgerRow[]
}) {
  const [historyOpen, setHistoryOpen] = useState(true)
  const [eventsOpen, setEventsOpen] = useState(true)
  const [resultsOpen, setResultsOpen] = useState(true)
  const [citiesOpen, setCitiesOpen] = useState(false)

  const [eventQuery, setEventQuery] = useState('')
  const [eventPhase, setEventPhase] = useState('all')

  const [resultQuery, setResultQuery] = useState('')
  const [resultPhase, setResultPhase] = useState('all')

  const [cityQuery, setCityQuery] = useState('')
  const [compactMode, setCompactMode] = useState(true)

  const filteredEvents = useMemo(() => {
    const q = eventQuery.trim().toLowerCase()
    return runEvents.filter((row) => {
      if (eventPhase !== 'all' && row.phase !== eventPhase) return false
      if (!q) return true
      const pool = [
        row.phase,
        row.run_id || '',
        payloadText(row.payload, 'dispatcher'),
        payloadText(row.payload, 'dispatch_status'),
        payloadText(row.payload, 'dispatch_error'),
        payloadText(row.payload, 'errorClass'),
        payloadText(row.payload, 'errorCode'),
      ]
      return pool.join(' ').toLowerCase().includes(q)
    })
  }, [eventPhase, eventQuery, runEvents])

  const filteredResults = useMemo(() => {
    const q = resultQuery.trim().toLowerCase()
    return runResults.filter((row) => {
      if (resultPhase !== 'all' && row.phase !== resultPhase) return false
      if (!q) return true
      const selectedCities = Array.isArray(row.selected_cities)
        ? row.selected_cities.join(' ')
        : Array.isArray(row.target_locations)
          ? row.target_locations.join(' ')
          : ''
      return `${row.run_id} ${selectedCities}`.toLowerCase().includes(q)
    })
  }, [resultPhase, resultQuery, runResults])

  const filteredCities = useMemo(() => {
    const q = cityQuery.trim().toLowerCase()
    if (!q) return cityLedger
    return cityLedger.filter((row) => {
      return `${row.city_label} ${row.city_key} ${row.last_run_id || ''}`.toLowerCase().includes(q)
    })
  }, [cityLedger, cityQuery])

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <div className="sticky top-2 z-20 lg:col-span-2">
        <div className="rounded-xl border border-gray-200 bg-white/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setHistoryOpen(true)
                setEventsOpen(true)
                setResultsOpen(true)
                setCitiesOpen(true)
              }}
              className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={() => {
                setHistoryOpen(false)
                setEventsOpen(false)
                setResultsOpen(false)
                setCitiesOpen(false)
              }}
              className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Collapse All
            </button>
            <label className="ml-auto inline-flex items-center gap-2 text-xs font-medium text-gray-700">
              <input
                type="checkbox"
                checked={compactMode}
                onChange={(e) => setCompactMode(e.target.checked)}
              />
              Compact Table Mode (Results + Ledger)
            </label>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="block text-xs text-gray-600">
              Event Search
              <input
                value={eventQuery}
                onChange={(e) => setEventQuery(e.target.value)}
                placeholder="run id, dispatcher, error"
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
              />
            </label>
            <label className="block text-xs text-gray-600">
              Event Phase
              <select
                value={eventPhase}
                onChange={(e) => setEventPhase(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
              >
                <option value="all">All</option>
                <option value="trigger_requested">trigger_requested</option>
                <option value="started">started</option>
                <option value="completed">completed</option>
                <option value="failed">failed</option>
              </select>
            </label>
            <label className="block text-xs text-gray-600">
              Run Results Search
              <input
                value={resultQuery}
                onChange={(e) => setResultQuery(e.target.value)}
                placeholder="run id or city"
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
              />
            </label>
            <label className="block text-xs text-gray-600">
              Result Phase
              <select
                value={resultPhase}
                onChange={(e) => setResultPhase(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
              >
                <option value="all">All</option>
                <option value="completed">completed</option>
                <option value="failed">failed</option>
              </select>
            </label>
            <label className="block text-xs text-gray-600">
              City Ledger Search
              <input
                value={cityQuery}
                onChange={(e) => setCityQuery(e.target.value)}
                placeholder="city or run id"
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
              />
            </label>
          </div>
        </div>
      </div>

      <details
        open={historyOpen}
        onToggle={(e) => setHistoryOpen((e.currentTarget as HTMLDetailsElement).open)}
        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <summary className="cursor-pointer list-none text-sm font-semibold text-gray-900">
          Recent Config Changes
          <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{history.length}</span>
        </summary>
        <ul className="mt-3 max-h-72 divide-y divide-gray-100 overflow-y-auto pr-1 text-sm">
          {history.length === 0 ? (
            <li className="py-2 text-gray-500">No changes yet.</li>
          ) : (
            history.map((row) => (
              <li key={row.id} className="py-2">
                <div className="text-gray-800">{row.changed_by_email ?? '—'}</div>
                <div className="text-xs text-gray-500">{new Date(row.created_at).toLocaleString()}</div>
                <div className="text-xs text-gray-600">{row.change_note || '—'}</div>
              </li>
            ))
          )}
        </ul>
      </details>

      <details
        id="scraper-events"
        open={eventsOpen}
        onToggle={(e) => setEventsOpen((e.currentTarget as HTMLDetailsElement).open)}
        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <summary className="cursor-pointer list-none text-sm font-semibold text-gray-900">
          Recent Scraper Run Events
          <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{filteredEvents.length}</span>
        </summary>
        <ul className="mt-3 max-h-96 divide-y divide-gray-100 overflow-y-auto pr-1 text-sm">
          {filteredEvents.length === 0 ? (
            <li className="py-2 text-gray-500">No matching run events.</li>
          ) : (
            filteredEvents.map((row) => (
              <li key={row.id} className="py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-gray-800">{row.phase}</span>
                  {row.phase === 'trigger_requested' ? (
                    <>
                      <span className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-[11px] text-blue-700">
                        via: {payloadText(row.payload, 'dispatcher')}
                      </span>
                      <span className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] text-slate-700">
                        dispatch: {payloadText(row.payload, 'dispatch_status')}
                      </span>
                    </>
                  ) : null}
                  {row.phase === 'failed' ? (
                    <>
                      <span className="rounded border border-red-200 bg-red-50 px-2 py-0.5 font-mono text-[11px] text-red-700">
                        class: {payloadText(row.payload, 'errorClass')}
                      </span>
                      <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 font-mono text-[11px] text-amber-700">
                        code: {payloadText(row.payload, 'errorCode')}
                      </span>
                    </>
                  ) : null}
                </div>
                <div className="text-xs text-gray-600">run_id: {row.run_id || '—'}</div>
                {row.phase === 'trigger_requested' ? (
                  <>
                    <div className="text-xs text-gray-600">trigger_request_id: {payloadText(row.payload, 'trigger_request_id')}</div>
                    <div className="text-xs text-gray-600">dispatch_error: {payloadText(row.payload, 'dispatch_error')}</div>
                  </>
                ) : null}
                <div className="text-xs text-gray-500">{new Date(row.created_at).toLocaleString()}</div>
              </li>
            ))
          )}
        </ul>
      </details>

      <details
        id="scraper-results"
        open={resultsOpen}
        onToggle={(e) => setResultsOpen((e.currentTarget as HTMLDetailsElement).open)}
        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2"
      >
        <summary className="cursor-pointer list-none text-sm font-semibold text-gray-900">
          Run Results (Stored In Supabase)
          <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{filteredResults.length}</span>
        </summary>

        {compactMode ? (
          <div className="mt-3 max-h-[28rem] overflow-auto rounded-md border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">run_id</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">phase</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">leads</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">cities</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">saved</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredResults.map((row) => {
                  const selectedCount = Array.isArray(row.selected_cities)
                    ? row.selected_cities.length
                    : Array.isArray(row.target_locations)
                      ? row.target_locations.length
                      : 0
                  return (
                    <tr key={row.run_id}>
                      <td className="px-3 py-2 font-mono text-gray-700">{row.run_id}</td>
                      <td className="px-3 py-2 text-gray-700">{row.phase}</td>
                      <td className="px-3 py-2 text-gray-700">{row.lead_count}</td>
                      <td className="px-3 py-2 text-gray-700">{selectedCount}</td>
                      <td className="px-3 py-2 text-gray-500">{new Date(row.created_at).toLocaleString()}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2">
                          <a
                            href={`/admin/scraper/results/${encodeURIComponent(row.run_id)}?format=json`}
                            className="rounded border border-gray-300 px-2 py-0.5 text-gray-700 hover:bg-gray-50"
                          >
                            JSON
                          </a>
                          <a
                            href={`/admin/scraper/results/${encodeURIComponent(row.run_id)}?format=csv`}
                            className="rounded border border-gray-300 px-2 py-0.5 text-gray-700 hover:bg-gray-50"
                          >
                            CSV
                          </a>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <ul className="mt-3 max-h-[28rem] divide-y divide-gray-100 overflow-y-auto pr-1 text-sm">
            {filteredResults.length === 0 ? (
              <li className="py-2 text-gray-500">No matching run results.</li>
            ) : (
              filteredResults.map((row) => {
                const selectedCount = Array.isArray(row.selected_cities)
                  ? row.selected_cities.length
                  : Array.isArray(row.target_locations)
                    ? row.target_locations.length
                    : 0

                return (
                  <li key={row.run_id} className="py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-gray-800">{row.phase}</span>
                      <span className="text-xs text-gray-700">run_id: <span className="font-mono">{row.run_id}</span></span>
                    </div>
                    <div className="mt-1 text-xs text-gray-600">
                      leads: {row.lead_count} | selected cities: {selectedCount}
                    </div>
                    <div className="text-xs text-gray-500">saved: {new Date(row.created_at).toLocaleString()}</div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs">
                      <a
                        href={`/admin/scraper/results/${encodeURIComponent(row.run_id)}?format=json`}
                        className="rounded border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-50"
                      >
                        Download JSON
                      </a>
                      <a
                        href={`/admin/scraper/results/${encodeURIComponent(row.run_id)}?format=csv`}
                        className="rounded border border-gray-300 px-2 py-1 text-gray-700 hover:bg-gray-50"
                      >
                        Download CSV
                      </a>
                    </div>
                  </li>
                )
              })
            )}
          </ul>
        )}
      </details>

      <details
        id="scraper-cities"
        open={citiesOpen}
        onToggle={(e) => setCitiesOpen((e.currentTarget as HTMLDetailsElement).open)}
        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2"
      >
        <summary className="cursor-pointer list-none text-sm font-semibold text-gray-900">
          Cities Already Scraped (Dedupe Ledger)
          <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{filteredCities.length}</span>
        </summary>

        {compactMode ? (
          <div className="mt-3 max-h-[30rem] overflow-auto rounded-md border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">city</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">runs</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">last_run_id</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">last_scraped</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredCities.map((row) => (
                  <tr key={row.city_key}>
                    <td className="px-3 py-2 font-medium text-gray-800">{row.city_label}</td>
                    <td className="px-3 py-2 text-gray-700">{row.run_count}</td>
                    <td className="px-3 py-2 font-mono text-gray-700">{row.last_run_id || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{new Date(row.last_scraped_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ul className="mt-3 max-h-[30rem] divide-y divide-gray-100 overflow-y-auto pr-1 text-sm">
            {filteredCities.length === 0 ? (
              <li className="py-2 text-gray-500">No matching cities tracked.</li>
            ) : (
              filteredCities.map((row) => (
                <li key={row.city_key} className="py-2">
                  <div className="font-medium text-gray-800">{row.city_label}</div>
                  <div className="text-xs text-gray-600">runs: {row.run_count} | last_run_id: {row.last_run_id || '—'}</div>
                  <div className="text-xs text-gray-500">last scraped: {new Date(row.last_scraped_at).toLocaleString()}</div>
                </li>
              ))
            )}
          </ul>
        )}
      </details>
    </section>
  )
}
