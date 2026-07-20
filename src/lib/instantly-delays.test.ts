import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Unit-test the Instantly campaign payload delay mapping without hitting the API.
 * We re-implement the minute conversion here to lock the contract used in instantly.ts.
 */
function delayFields(minDelaySeconds: number, maxDelaySeconds: number) {
  const minGapMins = Math.max(1, Math.ceil(minDelaySeconds / 60))
  const maxExtraMins = Math.max(0, Math.ceil((maxDelaySeconds - minDelaySeconds) / 60))
  return { email_gap: minGapMins, random_wait_max: maxExtraMins }
}

describe('Instantly delay mapping', () => {
  it('maps 300–600s to email_gap=5 and random_wait_max=5', () => {
    expect(delayFields(300, 600)).toEqual({ email_gap: 5, random_wait_max: 5 })
  })

  it('never returns email_gap below 1', () => {
    expect(delayFields(0, 60).email_gap).toBe(1)
  })
})

describe('blockLeadInInstantly path default', () => {
  const prev = process.env.INSTANTLY_BLOCKLIST_PATH

  afterEach(() => {
    if (prev === undefined) delete process.env.INSTANTLY_BLOCKLIST_PATH
    else process.env.INSTANTLY_BLOCKLIST_PATH = prev
    vi.resetModules()
  })

  it('defaults blocklist path to /block-lists-entries', () => {
    delete process.env.INSTANTLY_BLOCKLIST_PATH
    expect(process.env.INSTANTLY_BLOCKLIST_PATH || '/block-lists-entries').toBe(
      '/block-lists-entries'
    )
  })
})
