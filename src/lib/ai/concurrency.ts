/**
 * Small concurrency primitives for the AI pipeline.
 *
 * Deliberately hand-rolled rather than pulling in `p-limit`: this is three
 * short functions, and the worker image is happier without another dependency.
 *
 * The redesign needs all three:
 *  - `createSemaphore` caps how many calls a single model provider sees at once.
 *  - `mapWithConcurrency` fans the per-page generation out.
 *  - `createSerializer` protects the shared draft and the `custom_build_job`
 *    read-modify-write, which are the two things that make naive `Promise.all`
 *    unsafe here.
 */

export type Semaphore = {
  acquire(): Promise<() => void>
  /** In-flight count; for assertions and logging. */
  readonly active: number
}

export function createSemaphore(limit: number): Semaphore {
  const max = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 1
  const waiters: Array<() => void> = []
  let active = 0

  const release = () => {
    active -= 1
    const next = waiters.shift()
    if (next) next()
  }

  return {
    get active() {
      return active
    },
    async acquire() {
      if (active >= max) {
        await new Promise<void>((resolve) => waiters.push(resolve))
      }
      active += 1
      let released = false
      // Idempotent so a `finally` that runs twice cannot corrupt the count.
      return () => {
        if (released) return
        released = true
        release()
      }
    },
  }
}

/**
 * Map with a bounded number of in-flight tasks, preserving input order in the
 * results. Rejections are captured per item rather than aborting the pool —
 * one failed page must not discard the sibling pages already in flight.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<Array<{ item: T; index: number } & ({ ok: true; value: R } | { ok: false; error: unknown })>> {
  const max = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 1
  const results: Array<
    { item: T; index: number } & ({ ok: true; value: R } | { ok: false; error: unknown })
  > = new Array(items.length)
  let cursor = 0

  const worker = async () => {
    for (;;) {
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      const item = items[index]
      try {
        results[index] = { item, index, ok: true, value: await fn(item, index) }
      } catch (error) {
        results[index] = { item, index, ok: false, error }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(max, items.length) }, worker))
  return results
}

/**
 * Run critical sections one at a time, in call order.
 *
 * Used around `mergePageIntoDraft` + `checkpoint` + `report`: each is a
 * read-modify-write of shared state (the draft, and `custom_build_job` via
 * `patchProgress`), so overlapping them loses updates.
 */
export function createSerializer(): <T>(fn: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve()
  return <T>(fn: () => Promise<T>): Promise<T> => {
    // Chain off the previous task's settlement, not its value, so one
    // rejection does not poison every later section.
    const run = tail.then(fn, fn)
    tail = run.then(
      () => undefined,
      () => undefined
    )
    return run as Promise<T>
  }
}
