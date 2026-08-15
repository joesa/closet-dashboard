import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Ambient "which pass is this model call for" context.
 *
 * `ai_text_call` already logs duration, tokens and cost per provider call, and
 * the job logs a total — but nothing connects the two, so a 6-minute redesign
 * could be seven page calls or three pages plus four guard repairs and there is
 * no way to tell from the logs.
 *
 * AsyncLocalStorage rather than a module-level "current pass" variable: once
 * pages generate concurrently, a single mutable variable reports whichever pass
 * happened to start last. Async context follows each call chain independently,
 * including across Promise.all branches.
 */
export type AiCallContext = {
  /** Stable per redesign run; a Graphile resume reuses it. */
  runId: string
  /** e.g. 'foundation', 'page:/about', 'page:/about:repair', 'uniqueness'. */
  pass: string
}

export const aiCallContext = new AsyncLocalStorage<AiCallContext>()

export function withAiCallContext<T>(ctx: AiCallContext, fn: () => Promise<T>): Promise<T> {
  return aiCallContext.run(ctx, fn)
}

export function currentAiCallContext(): AiCallContext | undefined {
  return aiCallContext.getStore()
}

export type PassTiming = {
  pass: string
  ms: number
  startedAt: string
  ok: boolean
}

/** Keeps the JSONB job row bounded when a run retries many passes. */
export const MAX_PASS_TIMINGS = 40

export function appendPassTiming(
  existing: PassTiming[] | undefined,
  timing: PassTiming
): PassTiming[] {
  const next = [...(Array.isArray(existing) ? existing : []), timing]
  return next.length > MAX_PASS_TIMINGS ? next.slice(next.length - MAX_PASS_TIMINGS) : next
}

/**
 * Time one pass and return both its result and its timing. Failures are timed
 * too — a pass that burns four minutes and then throws is exactly what we want
 * to see in the summary.
 */
export async function timePass<T>(
  runId: string,
  pass: string,
  fn: () => Promise<T>
): Promise<{ value: T; timing: PassTiming }> {
  const startedAt = new Date().toISOString()
  const start = Date.now()
  try {
    const value = await withAiCallContext({ runId, pass }, fn)
    return { value, timing: { pass, ms: Date.now() - start, startedAt, ok: true } }
  } catch (err) {
    const timing: PassTiming = { pass, ms: Date.now() - start, startedAt, ok: false }
    ;(err as { passTiming?: PassTiming }).passTiming = timing
    throw err
  }
}
