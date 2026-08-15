import { describe, expect, it, afterEach } from 'vitest'
import { resolveFullRedesignPageConcurrency } from '@/lib/ai/generateCustomSite'

const original = process.env.FULL_REDESIGN_PAGE_CONCURRENCY
afterEach(() => {
  if (original === undefined) delete process.env.FULL_REDESIGN_PAGE_CONCURRENCY
  else process.env.FULL_REDESIGN_PAGE_CONCURRENCY = original
})

describe('resolveFullRedesignPageConcurrency', () => {
  it('defaults to 3', () => {
    delete process.env.FULL_REDESIGN_PAGE_CONCURRENCY
    expect(resolveFullRedesignPageConcurrency()).toBe(5)
  })
  it('honors 1 as the serial rollback', () => {
    process.env.FULL_REDESIGN_PAGE_CONCURRENCY = '1'
    expect(resolveFullRedesignPageConcurrency()).toBe(1)
  })
  it('caps runaway values and ignores junk', () => {
    process.env.FULL_REDESIGN_PAGE_CONCURRENCY = '99'
    expect(resolveFullRedesignPageConcurrency()).toBe(8)
    process.env.FULL_REDESIGN_PAGE_CONCURRENCY = 'abc'
    expect(resolveFullRedesignPageConcurrency()).toBe(5)
    process.env.FULL_REDESIGN_PAGE_CONCURRENCY = '0'
    expect(resolveFullRedesignPageConcurrency()).toBe(5)
  })
})
