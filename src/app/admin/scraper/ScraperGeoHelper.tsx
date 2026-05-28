'use client'

import { useEffect, useMemo, useState } from 'react'

type StateCatalogRow = {
  state_code: string
  state_name: string
  cities: string[]
}

function toKeywordList(value: string): string[] {
  return value
    .split(/[\n,]/g)
    .map((v) => v.trim())
    .filter(Boolean)
}

function setFormField(name: string, value: string): void {
  const el = document.querySelector(`[name="${name}"]`) as HTMLTextAreaElement | HTMLInputElement | null
  if (!el) return
  el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

export default function ScraperGeoHelper({
  states,
  defaultKeywords,
}: {
  states: StateCatalogRow[]
  defaultKeywords: string[]
}) {
  const [selectedStateCode, setSelectedStateCode] = useState(states[0]?.state_code ?? 'CA')
  const selectedState = useMemo(
    () => states.find((s) => s.state_code === selectedStateCode) ?? states[0],
    [selectedStateCode, states]
  )

  const [keywordsInput, setKeywordsInput] = useState(defaultKeywords.join(', '))
  const [selectedCities, setSelectedCities] = useState<string[]>(selectedState?.cities ?? [])
  const [autoSync, setAutoSync] = useState(true)

  useEffect(() => {
    const st = states.find((s) => s.state_code === selectedStateCode)
    setSelectedCities(st?.cities ?? [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStateCode])

  const locationList = useMemo(() => {
    if (!selectedState) return []
    return selectedCities.map((city) => `${city}, ${selectedState.state_name}`)
  }, [selectedCities, selectedState])

  const startUrls = useMemo(() => {
    const keywords = toKeywordList(keywordsInput)
    const out: string[] = []
    for (const keyword of keywords) {
      for (const location of locationList) {
        out.push(`https://www.google.com/maps/search/${encodeURIComponent(`${keyword} ${location}`)}`)
      }
    }
    return out
  }, [keywordsInput, locationList])

  function toggleCity(city: string, checked: boolean) {
    setSelectedCities((current) => {
      if (checked) {
        if (current.includes(city)) return current
        return [...current, city]
      }
      return current.filter((c) => c !== city)
    })
  }

  function applyToForm() {
    setFormField('mapsKeywords', toKeywordList(keywordsInput).join(', '))
    setFormField('targetLocations', locationList.join('\n'))
    setFormField('cityPool', locationList.join('\n'))
    setFormField('startUrls', startUrls.join('\n'))
  }

  useEffect(() => {
    if (!autoSync) return
    applyToForm()
  }, [autoSync, keywordsInput, locationList.join('|'), startUrls.join('|')])

  if (!states.length || !selectedState) return null

  return (
    <section className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-sky-50 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Geo + Query Helper (General Purpose)</h2>
        <label className="inline-flex items-center gap-2 text-xs text-gray-700">
          <input type="checkbox" checked={autoSync} onChange={(e) => setAutoSync(e.target.checked)} />
          Auto-sync to form fields
        </label>
      </div>
      <p className="mt-1 text-xs text-gray-600">
        Pick any state, choose cities, and type any service keywords. This auto-generates Target Locations in
        <span className="font-mono"> City, State</span> format and maps Start URLs.
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="block text-xs text-gray-700">
          State
          <select
            value={selectedStateCode}
            onChange={(e) => setSelectedStateCode(e.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm"
          >
            {states.map((state) => (
              <option key={state.state_code} value={state.state_code}>
                {state.state_name} ({state.state_code})
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs text-gray-700">
          Service Keywords (comma/newline)
          <textarea
            value={keywordsInput}
            onChange={(e) => setKeywordsInput(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm"
            placeholder="plumbers, hvac repair, roofing"
          />
        </label>
      </div>

      <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className="text-xs font-medium text-gray-700">Cities for {selectedState.state_name}</div>
          <button
            type="button"
            onClick={() => setSelectedCities(selectedState.cities)}
            className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={() => setSelectedCities([])}
            className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
        <div className="grid max-h-40 grid-cols-1 gap-1 overflow-y-auto pr-1 sm:grid-cols-2 md:grid-cols-3">
          {selectedState.cities.map((city) => {
            const checked = selectedCities.includes(city)
            return (
              <label key={city} className="inline-flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => toggleCity(city, e.target.checked)}
                />
                {city}
              </label>
            )
          })}
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="text-xs font-medium text-gray-700">Target Locations Preview ({locationList.length})</div>
          <div className="mt-2 max-h-28 overflow-y-auto whitespace-pre-wrap font-mono text-xs text-gray-600">
            {locationList.join('\n') || 'Select one or more cities'}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="text-xs font-medium text-gray-700">Start URLs Preview ({startUrls.length})</div>
          <div className="mt-2 max-h-28 overflow-y-auto whitespace-pre-wrap font-mono text-xs text-gray-600">
            {startUrls.slice(0, 10).join('\n') || 'Type keywords and select cities'}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={applyToForm}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
        >
          Apply Helper Values To Form
        </button>
        <span className="text-xs text-gray-600">
          Updates <span className="font-mono">mapsKeywords</span>, <span className="font-mono">targetLocations</span>,
          <span className="font-mono">cityPool</span>, and <span className="font-mono">startUrls</span>.
        </span>
      </div>
    </section>
  )
}
