import { describe, expect, it } from 'vitest'
import { median, summarizeLighthouse } from '../../../scripts/template-quality-metrics.mjs'

describe('template quality metrics', () => {
  it('uses median performance so one cold outlier cannot fail a release', () => {
    expect(median([3150, 9200, 3400])).toBe(3400)
  })

  it('keeps the strictest accessibility score while stabilizing web vitals', () => {
    expect(summarizeLighthouse([
      { accessibilityScore: 1, cls: 0.01, lcp: 3000 },
      { accessibilityScore: 0.94, cls: 0.03, lcp: 3200 },
      { accessibilityScore: 0.98, cls: 0.8, lcp: 9000 },
    ])).toMatchObject({ accessibilityScore: 0.94, cls: 0.03, lcp: 3200 })
  })
})
