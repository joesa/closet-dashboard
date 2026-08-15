import { describe, expect, it } from 'vitest'
import { createSemaphore, createSerializer, mapWithConcurrency } from './concurrency'

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms))

describe('createSemaphore', () => {
  it('never lets more than `limit` holders through at once', async () => {
    const semaphore = createSemaphore(2)
    let peak = 0
    await Promise.all(
      Array.from({ length: 8 }, async () => {
        const release = await semaphore.acquire()
        peak = Math.max(peak, semaphore.active)
        await tick(5)
        release()
      })
    )
    expect(peak).toBe(2)
    expect(semaphore.active).toBe(0)
  })

  it('releases idempotently so a double finally cannot corrupt the count', async () => {
    const semaphore = createSemaphore(1)
    const release = await semaphore.acquire()
    release()
    release()
    expect(semaphore.active).toBe(0)
    const second = await semaphore.acquire()
    expect(semaphore.active).toBe(1)
    second()
  })

  it('treats a non-positive limit as 1 rather than deadlocking', async () => {
    const semaphore = createSemaphore(0)
    const release = await semaphore.acquire()
    expect(semaphore.active).toBe(1)
    release()
  })
})

describe('mapWithConcurrency', () => {
  it('caps in-flight work and preserves input order in the results', async () => {
    let inFlight = 0
    let peak = 0
    const items = [1, 2, 3, 4, 5, 6, 7]

    const results = await mapWithConcurrency(items, 3, async (item) => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      // Reverse the delays so completion order differs from input order.
      await tick((10 - item) * 3)
      inFlight -= 1
      return item * 2
    })

    expect(peak).toBeLessThanOrEqual(3)
    expect(results.map((r) => (r.ok ? r.value : null))).toEqual([2, 4, 6, 8, 10, 12, 14])
    expect(results.every((r) => r.ok)).toBe(true)
  })

  it('captures a rejection per item without stalling or aborting the pool', async () => {
    const results = await mapWithConcurrency([1, 2, 3, 4], 2, async (item) => {
      await tick(2)
      if (item === 2) throw new Error(`boom ${item}`)
      return item
    })

    expect(results.filter((r) => r.ok)).toHaveLength(3)
    const failed = results.find((r) => !r.ok)
    expect(failed?.item).toBe(2)
    expect((failed as { error: Error }).error.message).toBe('boom 2')
  })

  it('handles an empty list', async () => {
    expect(await mapWithConcurrency([], 3, async () => 1)).toEqual([])
  })
})

describe('createSerializer', () => {
  it('never overlaps critical sections', async () => {
    const serialize = createSerializer()
    let inside = false
    let overlapped = false

    await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        serialize(async () => {
          if (inside) overlapped = true
          inside = true
          await tick(3)
          inside = false
          return i
        })
      )
    )
    expect(overlapped).toBe(false)
  })

  it('runs sections in call order', async () => {
    const serialize = createSerializer()
    const order: number[] = []
    await Promise.all(
      [30, 5, 1].map((delay, i) =>
        serialize(async () => {
          await tick(delay)
          order.push(i)
        })
      )
    )
    expect(order).toEqual([0, 1, 2])
  })

  it('keeps running later sections after one rejects', async () => {
    const serialize = createSerializer()
    const ran: string[] = []

    const failing = serialize(async () => {
      ran.push('first')
      throw new Error('nope')
    })
    const after = serialize(async () => {
      ran.push('second')
      return 'ok'
    })

    await expect(failing).rejects.toThrow('nope')
    await expect(after).resolves.toBe('ok')
    expect(ran).toEqual(['first', 'second'])
  })
})
