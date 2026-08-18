import { afterEach, describe, expect, it } from 'vitest'
import { preflightReviewBudget } from '@/lib/ai/enhanceFullRedesignBrief'

/**
 * The review budget is the main lever on time-to-first-page, so its bounds are
 * worth pinning: a typo in the env var must not disable the design review
 * (0 attempts would ship an unreviewed first draft) or let it run away.
 */
const ORIGINAL = process.env.FULL_REDESIGN_PREFLIGHT_REVIEWS

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.FULL_REDESIGN_PREFLIGHT_REVIEWS
  else process.env.FULL_REDESIGN_PREFLIGHT_REVIEWS = ORIGINAL
})

function withEnv(value: string | undefined): number {
  if (value === undefined) delete process.env.FULL_REDESIGN_PREFLIGHT_REVIEWS
  else process.env.FULL_REDESIGN_PREFLIGHT_REVIEWS = value
  return preflightReviewBudget()
}

describe('preflight review budget', () => {
  it('defaults to the original three attempts', () => {
    expect(withEnv(undefined)).toBe(3)
  })

  it('honours a deliberate lower budget', () => {
    expect(withEnv('1')).toBe(1)
  })

  it('never drops below one review — an unreviewed direction must not ship', () => {
    expect(withEnv('0')).toBe(1)
    expect(withEnv('-4')).toBe(1)
  })

  it('caps runaway values and ignores nonsense', () => {
    expect(withEnv('99')).toBe(5)
    expect(withEnv('banana')).toBe(3)
  })
})
