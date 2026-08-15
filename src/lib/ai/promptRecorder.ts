import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Captures the exact prompts a Full redesign sent, so a finished build can show
 * its own inputs.
 *
 * "What produced this site?" was previously unanswerable after the fact: the
 * brief lives in the job reply, but the system prompt, the per-page user
 * prompts, and anything a guard repair sent were only ever in worker stdout,
 * rotated away within days.
 *
 * AsyncLocalStorage rather than a runId-keyed map: pages generate concurrently
 * and a map would need manual cleanup on every throw path. The scope ends when
 * the generation call returns, which is also when the recording should stop.
 *
 * Server-only.
 */

export type RecordedPrompt = {
  /** 'foundation', 'page:/about', 'repair', … — null when no pass context. */
  pass: string | null
  provider: string
  model: string
  /** The endpoint slug when admin routing chose it, else null. */
  endpoint: string | null
  systemPrompt: string | null
  userPrompt: string
  imageCount: number
  durationMs: number
  ok: boolean
  at: string
}

type Recorder = { prompts: RecordedPrompt[] }

const storage = new AsyncLocalStorage<Recorder>()

/**
 * A single prompt can run to tens of thousands of characters and a run makes a
 * dozen calls, so the payload is capped to keep one row readable and bounded.
 */
const MAX_PROMPT_CHARS = 60_000
const MAX_PROMPTS = 40

function clamp(text: string): string {
  if (text.length <= MAX_PROMPT_CHARS) return text
  return `${text.slice(0, MAX_PROMPT_CHARS)}\n\n…[truncated ${text.length - MAX_PROMPT_CHARS} chars]`
}

/** Run `fn` with recording active. Nested scopes reuse the outermost recorder. */
export async function withPromptRecording<T>(fn: () => Promise<T>): Promise<T> {
  if (storage.getStore()) return fn()
  return storage.run({ prompts: [] }, fn)
}

/**
 * What has been recorded in the current scope, in call order. Empty outside a
 * scope, so callers never have to know whether recording is on.
 */
export function getRecordedPrompts(): RecordedPrompt[] {
  return storage.getStore()?.prompts ?? []
}

/**
 * Record one model call. A no-op outside a recording scope, so every other
 * caller of the text provider is unaffected.
 */
export function recordPrompt(entry: Omit<RecordedPrompt, 'at'>): void {
  const recorder = storage.getStore()
  if (!recorder) return
  if (recorder.prompts.length >= MAX_PROMPTS) return
  recorder.prompts.push({
    ...entry,
    systemPrompt: entry.systemPrompt ? clamp(entry.systemPrompt) : null,
    userPrompt: clamp(entry.userPrompt),
    at: new Date().toISOString(),
  })
}

export function isRecordingPrompts(): boolean {
  return !!storage.getStore()
}

/** Plain-text rendering for the download button. */
export function formatPromptsForDownload(
  prompts: RecordedPrompt[],
  meta: { brandName?: string; runId?: string; startedAt?: string }
): string {
  const header = [
    `Full redesign prompts`,
    meta.brandName ? `Site:     ${meta.brandName}` : null,
    meta.runId ? `Run:      ${meta.runId}` : null,
    meta.startedAt ? `Started:  ${meta.startedAt}` : null,
    `Calls:    ${prompts.length}`,
    '',
  ]
    .filter(Boolean)
    .join('\n')

  const body = prompts
    .map((p, i) => {
      const title = `${i + 1}. ${p.pass ?? 'unnamed pass'} — ${p.provider}/${p.model}${p.endpoint ? ` (endpoint: ${p.endpoint})` : ''} — ${(p.durationMs / 1000).toFixed(1)}s${p.ok ? '' : ' — FAILED'}`
      return [
        '='.repeat(78),
        title,
        '='.repeat(78),
        p.imageCount ? `[${p.imageCount} image(s) attached]` : null,
        '',
        '--- SYSTEM PROMPT ---',
        p.systemPrompt ?? '(none)',
        '',
        '--- USER PROMPT ---',
        p.userPrompt,
        '',
      ]
        .filter((line) => line !== null)
        .join('\n')
    })
    .join('\n')

  return `${header}\n${body}`
}
