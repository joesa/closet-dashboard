'use client'

import { useState } from 'react'

/**
 * The exact model inputs behind the current draft, collapsed by default.
 *
 * Collapsed because the payload is tens of thousands of characters and nobody
 * needs it on the way to Publish — but when a build comes out wrong, the first
 * question is always "what did we actually ask for", and that used to require
 * reading worker stdout before it rotated away.
 *
 * Fetched on first expand rather than with the page: the admin screen already
 * loads a lot, and this is the rare path.
 */

type RecordedPrompt = {
  pass: string | null
  provider: string
  model: string
  endpoint: string | null
  systemPrompt: string | null
  userPrompt: string
  imageCount: number
  durationMs: number
  ok: boolean
  at: string
}

type PromptRecord = {
  runId: string | null
  brandName: string | null
  startedAt: string | null
  prompts: RecordedPrompt[]
}

export default function RedesignPrompts({ tenantId }: { tenantId: string }) {
  const [record, setRecord] = useState<PromptRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [openPass, setOpenPass] = useState<number | null>(null)

  async function load() {
    if (loaded || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/sites/${tenantId}/prompts`)
      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error ?? `Failed to load (${res.status})`)
      } else {
        setRecord(payload as PromptRecord)
      }
      setLoaded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <details
      className="rounded-lg border border-neutral-700 bg-neutral-900/40"
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open) void load()
      }}
    >
      <summary className="cursor-pointer select-none px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-400 hover:text-neutral-200">
        Prompt used for this redesign
        {record ? (
          <span className="ml-2 font-mono normal-case text-neutral-500">
            {record.prompts.length} call{record.prompts.length === 1 ? '' : 's'}
          </span>
        ) : null}
      </summary>

      <div className="space-y-3 border-t border-neutral-800 p-4">
        {loading ? <p className="text-xs text-neutral-500">Loading…</p> : null}
        {error ? <p className="text-xs text-amber-300/90">{error}</p> : null}

        {record ? (
          <>
            <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
              {record.startedAt ? <span>Run started {new Date(record.startedAt).toLocaleString()}</span> : null}
              <a
                href={`/api/admin/sites/${tenantId}/prompts?download=1`}
                className="rounded border border-neutral-600 px-2 py-1 text-neutral-300 hover:bg-neutral-800"
              >
                Download .txt
              </a>
            </div>

            <ol className="space-y-2">
              {record.prompts.map((p, i) => (
                <li key={`${p.at}-${i}`} className="rounded border border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setOpenPass(openPass === i ? null : i)}
                    className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left text-xs hover:bg-neutral-800/50"
                  >
                    <span className="font-mono text-neutral-300">
                      {i + 1}. {p.pass ?? 'unnamed pass'}
                    </span>
                    <span className="text-neutral-500">
                      {p.provider}/{p.model}
                      {p.endpoint ? ` · ${p.endpoint}` : ''}
                    </span>
                    <span className="text-neutral-600">{(p.durationMs / 1000).toFixed(1)}s</span>
                    {p.imageCount > 0 ? (
                      <span className="text-neutral-600">{p.imageCount} image(s)</span>
                    ) : null}
                    {!p.ok ? <span className="text-red-400">failed</span> : null}
                    <span className="ml-auto text-neutral-600">{openPass === i ? '−' : '+'}</span>
                  </button>

                  {openPass === i ? (
                    <div className="space-y-3 border-t border-neutral-800 p-3">
                      {p.systemPrompt ? (
                        <div>
                          <div className="mb-1 text-[10px] uppercase tracking-wide text-neutral-500">
                            System prompt
                          </div>
                          <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded bg-neutral-950 p-3 text-[11px] leading-relaxed text-neutral-300">
                            {p.systemPrompt}
                          </pre>
                        </div>
                      ) : null}
                      <div>
                        <div className="mb-1 text-[10px] uppercase tracking-wide text-neutral-500">
                          User prompt
                        </div>
                        <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded bg-neutral-950 p-3 text-[11px] leading-relaxed text-neutral-300">
                          {p.userPrompt}
                        </pre>
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          </>
        ) : null}
      </div>
    </details>
  )
}
