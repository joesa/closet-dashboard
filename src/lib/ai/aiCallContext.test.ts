import { describe, expect, it } from 'vitest'
import {
  MAX_PASS_TIMINGS,
  appendPassTiming,
  currentAiCallContext,
  timePass,
  withAiCallContext,
} from './aiCallContext'
import type { PassTiming } from './aiCallContext'

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms))

describe('withAiCallContext', () => {
  it('survives nested awaits', async () => {
    await withAiCallContext({ runId: 'r1', pass: 'foundation' }, async () => {
      await tick(1)
      await (async () => {
        await tick(1)
        expect(currentAiCallContext()).toEqual({ runId: 'r1', pass: 'foundation' })
      })()
    })
  })

  it('keeps concurrent branches independent — the reason this is not a module variable', async () => {
    const seen: Array<string | undefined> = []

    await Promise.all(
      ['page:/about', 'page:/services', 'page:/contact'].map((pass, i) =>
        withAiCallContext({ runId: 'r1', pass }, async () => {
          // Stagger so the branches genuinely interleave.
          await tick((3 - i) * 5)
          seen.push(currentAiCallContext()?.pass)
        })
      )
    )

    expect(seen.sort()).toEqual(['page:/about', 'page:/contact', 'page:/services'])
  })

  it('is undefined outside any pass', () => {
    expect(currentAiCallContext()).toBeUndefined()
  })
})

describe('timePass', () => {
  it('returns the value and a successful timing', async () => {
    const { value, timing } = await timePass('r1', 'foundation', async () => {
      await tick(5)
      return 'done'
    })
    expect(value).toBe('done')
    expect(timing.pass).toBe('foundation')
    expect(timing.ok).toBe(true)
    expect(timing.ms).toBeGreaterThanOrEqual(4)
    expect(Number.isFinite(Date.parse(timing.startedAt))).toBe(true)
  })

  it('attaches a failed timing to the error — a pass that burns time then throws still shows up', async () => {
    const failing = timePass('r1', 'page:/about', async () => {
      await tick(5)
      throw new Error('provider exploded')
    })
    await expect(failing).rejects.toThrow('provider exploded')

    await failing.catch((err) => {
      const timing = (err as { passTiming?: PassTiming }).passTiming
      expect(timing?.pass).toBe('page:/about')
      expect(timing?.ok).toBe(false)
      expect(timing?.ms).toBeGreaterThanOrEqual(4)
    })
  })

  it('exposes the pass to code running inside it', async () => {
    const { value } = await timePass('r7', 'uniqueness', async () => currentAiCallContext())
    expect(value).toEqual({ runId: 'r7', pass: 'uniqueness' })
  })
})

describe('appendPassTiming', () => {
  const timing = (pass: string): PassTiming => ({
    pass,
    ms: 1,
    startedAt: new Date().toISOString(),
    ok: true,
  })

  it('appends rather than replacing', () => {
    const first = appendPassTiming(undefined, timing('a'))
    const second = appendPassTiming(first, timing('b'))
    expect(second.map((t) => t.pass)).toEqual(['a', 'b'])
  })

  it('tolerates a malformed existing value', () => {
    expect(appendPassTiming(undefined, timing('a'))).toHaveLength(1)
    expect(appendPassTiming([] as PassTiming[], timing('a'))).toHaveLength(1)
  })

  it('keeps the newest entries so the JSONB row stays bounded', () => {
    let list: PassTiming[] = []
    for (let i = 0; i < MAX_PASS_TIMINGS + 10; i += 1) list = appendPassTiming(list, timing(`p${i}`))
    expect(list).toHaveLength(MAX_PASS_TIMINGS)
    expect(list.at(-1)?.pass).toBe(`p${MAX_PASS_TIMINGS + 9}`)
    expect(list[0].pass).toBe('p10')
  })
})
