'use client'

import { useMemo, useState } from 'react'
import type { AdminAssignment, AdminProvider } from '@/lib/ai/aiConfigAdmin'

/**
 * Two panels: the endpoints that exist, and what each job uses.
 *
 * Deliberately plain forms rather than a drag-and-drop chain builder — an
 * ordered list of two or three entries is easier to reason about as text, and
 * this screen decides where customer-facing copy comes from.
 */

const KIND_LABEL: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  openai_compatible: 'OpenAI-compatible (Ollama, LM Studio, vLLM, LocalAI…)',
}

const FALLBACK_LABEL: Record<string, string> = {
  full_redesign: 'Built-in: Claude Opus 5 → GPT-5.6 Sol → Gemini 3.1 Pro',
  surgical: 'Built-in: Gemini → OpenAI → Anthropic',
  default: 'Built-in: GPT-5.6 Sol → Gemini → Anthropic',
  image: 'Built-in: gpt-image-1 → gemini-2.5-flash-image',
}

type TestState = { ok: boolean; models?: string[]; error?: string; latencyMs: number }

export default function AiModelsClient({
  initialProviders,
  initialAssignments,
}: {
  initialProviders: AdminProvider[]
  initialAssignments: AdminAssignment[]
}) {
  const [providers, setProviders] = useState(initialProviders)
  const [assignments, setAssignments] = useState(initialAssignments)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [tests, setTests] = useState<Record<string, TestState>>({})
  const [editing, setEditing] = useState<Partial<AdminProvider> & { apiKey?: string } | null>(
    null
  )

  const byCategory = useMemo(
    () => ({
      text: assignments.filter((a) => a.category === 'text'),
      image: assignments.filter((a) => a.category === 'image'),
    }),
    [assignments]
  )

  async function call<T>(url: string, init: RequestInit): Promise<T | null> {
    setError(null)
    try {
      const res = await fetch(url, {
        ...init,
        headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
      })
      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error ?? `Request failed (${res.status})`)
        return null
      }
      return payload as T
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return null
    }
  }

  async function saveProvider() {
    if (!editing) return
    setBusy('save')
    const payload = await call<{ provider: AdminProvider }>(
      '/api/admin/ai-config/providers',
      {
        method: 'POST',
        body: JSON.stringify({
          id: editing.id,
          slug: editing.slug,
          label: editing.label,
          kind: editing.kind ?? 'openai_compatible',
          baseUrl: editing.baseUrl ?? null,
          // Undefined leaves an existing stored key alone.
          ...(editing.apiKey !== undefined ? { apiKey: editing.apiKey } : {}),
          enabled: editing.enabled ?? true,
        }),
      }
    )
    setBusy(null)
    if (!payload) return
    const list = await call<{ providers: AdminProvider[] }>('/api/admin/ai-config/providers', {
      method: 'GET',
    })
    if (list) setProviders(list.providers)
    setEditing(null)
  }

  async function removeProvider(id: string) {
    setBusy(id)
    const ok = await call<{ ok: boolean }>(`/api/admin/ai-config/providers?id=${id}`, {
      method: 'DELETE',
    })
    setBusy(null)
    if (ok) setProviders((prev) => prev.filter((p) => p.id !== id))
  }

  async function testProvider(id: string) {
    setBusy(id)
    const result = await call<TestState>('/api/admin/ai-config/test', {
      method: 'POST',
      body: JSON.stringify({ id }),
    })
    setBusy(null)
    if (result) setTests((prev) => ({ ...prev, [id]: result }))
  }

  async function saveAssignment(purpose: string, chain: { providerSlug: string; model: string }[]) {
    setBusy(purpose)
    const payload = await call<{ assignments: AdminAssignment[] }>(
      '/api/admin/ai-config/assignments',
      { method: 'PUT', body: JSON.stringify({ purpose, chain }) }
    )
    setBusy(null)
    if (payload) setAssignments(payload.assignments)
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Providers
          </h2>
          <button
            type="button"
            onClick={() => setEditing({ kind: 'openai_compatible', enabled: true })}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add provider
          </button>
        </div>

        {providers.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">
            None yet. Everything runs on the built-in chains using the API keys in the
            environment.
          </p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="pb-2">Provider</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">Endpoint</th>
                <th className="pb-2">Key</th>
                <th className="pb-2">Last check</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {providers.map((p) => {
                const test = tests[p.id]
                return (
                  <tr key={p.id} className="align-top">
                    <td className="py-3">
                      <div className="font-medium text-gray-900">{p.label}</div>
                      <code className="text-xs text-gray-500">{p.slug}</code>
                      {!p.enabled && (
                        <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                          disabled
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-gray-600">{KIND_LABEL[p.kind] ?? p.kind}</td>
                    <td className="max-w-xs break-all py-3 text-xs text-gray-600">
                      {p.baseUrl ?? <span className="text-gray-400">vendor default</span>}
                    </td>
                    <td className="py-3 text-gray-600">
                      {p.hasKey ? (p.keyHint ?? 'stored') : <span className="text-gray-400">none</span>}
                    </td>
                    <td className="py-3 text-xs">
                      {test ? (
                        test.ok ? (
                          <span className="text-emerald-700">
                            OK ({test.latencyMs}ms
                            {test.models?.length ? `, ${test.models.length} models` : ''})
                          </span>
                        ) : (
                          <span className="text-red-700">{test.error}</span>
                        )
                      ) : p.lastCheckedAt ? (
                        <span className={p.lastCheckOk ? 'text-emerald-700' : 'text-red-700'}>
                          {p.lastCheckOk ? 'OK' : p.lastCheckError}
                          <br />
                          <span className="text-gray-400">
                            {new Date(p.lastCheckedAt).toLocaleString()}
                          </span>
                        </span>
                      ) : (
                        <span className="text-gray-400">never</span>
                      )}
                    </td>
                    <td className="space-x-2 whitespace-nowrap py-3 text-right">
                      <button
                        type="button"
                        disabled={busy === p.id}
                        onClick={() => testProvider(p.id)}
                        className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                      >
                        {busy === p.id ? 'Testing…' : 'Test'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing({ ...p })}
                        className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy === p.id}
                        onClick={() => removeProvider(p.id)}
                        className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {editing && (
          <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h3 className="text-sm font-semibold text-gray-900">
              {editing.id ? `Edit ${editing.label}` : 'New provider'}
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="text-gray-600">Label</span>
                <input
                  value={editing.label ?? ''}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                  placeholder="Workshop 4090"
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5"
                />
              </label>
              <label className="text-sm">
                <span className="text-gray-600">Slug (stable id used by assignments)</span>
                <input
                  value={editing.slug ?? ''}
                  onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                  placeholder="workshop-4090"
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 font-mono text-xs"
                />
              </label>
              <label className="text-sm">
                <span className="text-gray-600">Type</span>
                <select
                  value={editing.kind ?? 'openai_compatible'}
                  onChange={(e) =>
                    setEditing({ ...editing, kind: e.target.value as AdminProvider['kind'] })
                  }
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5"
                >
                  {Object.entries(KIND_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="text-gray-600">Base URL</span>
                <input
                  value={editing.baseUrl ?? ''}
                  onChange={(e) => setEditing({ ...editing, baseUrl: e.target.value })}
                  placeholder="https://gpu.example.ts.net/v1"
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 font-mono text-xs"
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="text-gray-600">
                  API key {editing.id && editing.hasKey ? '(leave blank to keep the stored key)' : '(optional for local runtimes)'}
                </span>
                <input
                  type="password"
                  value={editing.apiKey ?? ''}
                  onChange={(e) => setEditing({ ...editing, apiKey: e.target.value })}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 font-mono text-xs"
                />
              </label>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Local runtimes must be reachable from Vercel <em>and</em> the worker VM — a
              <code className="mx-1 rounded bg-gray-200 px-1">localhost</code> URL is not. Expose
              it with Tailscale, Cloudflare Tunnel or ngrok and use that hostname. For
              OpenAI-compatible runtimes the base URL usually ends in <code>/v1</code>.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={busy === 'save'}
                onClick={saveProvider}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy === 'save' ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------------- */}
      {(['text', 'image'] as const).map((category) => (
        <section key={category} className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {category === 'text' ? 'Text jobs' : 'Image jobs'}
          </h2>
          {category === 'image' && (
            <p className="mt-1 text-xs text-gray-500">
              Ollama and LM Studio are text-only and cannot serve these. A local provider
              works here only if it exposes OpenAI-compatible{' '}
              <code>/v1/images/generations</code> (LocalAI and some ComfyUI gateways do).
            </p>
          )}

          <div className="mt-4 space-y-4">
            {byCategory[category].map((a) => (
              <AssignmentRow
                key={a.purpose}
                assignment={a}
                providers={providers}
                busy={busy === a.purpose}
                onSave={(chain) => saveAssignment(a.purpose, chain)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function AssignmentRow({
  assignment,
  providers,
  busy,
  onSave,
}: {
  assignment: AdminAssignment
  providers: AdminProvider[]
  busy: boolean
  onSave: (chain: { providerSlug: string; model: string }[]) => void
}) {
  const [chain, setChain] = useState(assignment.chain)
  const dirty = JSON.stringify(chain) !== JSON.stringify(assignment.chain)

  return (
    <div className="rounded border border-gray-200 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="font-medium text-gray-900">{assignment.label}</div>
          <div className="text-xs text-gray-500">{assignment.description}</div>
        </div>
        <code className="text-xs text-gray-400">{assignment.purpose}</code>
      </div>

      {chain.length === 0 ? (
        <p className="mt-2 text-xs text-gray-500">
          Inherited — {FALLBACK_LABEL[assignment.fallback] ?? assignment.fallback}
        </p>
      ) : (
        <ol className="mt-2 space-y-2">
          {chain.map((entry, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-400">{i + 1}.</span>
              <select
                value={entry.providerSlug}
                onChange={(e) => {
                  const next = [...chain]
                  next[i] = { ...entry, providerSlug: e.target.value }
                  setChain(next)
                }}
                className="rounded border border-gray-300 px-2 py-1 text-sm"
              >
                {providers.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.label}
                  </option>
                ))}
              </select>
              <input
                value={entry.model}
                onChange={(e) => {
                  const next = [...chain]
                  next[i] = { ...entry, model: e.target.value }
                  setChain(next)
                }}
                placeholder="model id"
                className="rounded border border-gray-300 px-2 py-1 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setChain(chain.filter((_, j) => j !== i))}
                className="text-xs text-red-600 hover:underline"
              >
                remove
              </button>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={providers.length === 0}
          onClick={() =>
            setChain([...chain, { providerSlug: providers[0]?.slug ?? '', model: '' }])
          }
          className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
          title={providers.length === 0 ? 'Add a provider first' : undefined}
        >
          Add fallback step
        </button>
        {dirty && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onSave(chain)}
              className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setChain(assignment.chain)}
              className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
            >
              Reset
            </button>
          </>
        )}
        {!dirty && assignment.chain.length > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setChain([])
              onSave([])
            }}
            className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
          >
            Revert to built-in
          </button>
        )}
      </div>
    </div>
  )
}
