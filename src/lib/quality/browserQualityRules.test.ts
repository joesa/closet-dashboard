import { describe, expect, it } from 'vitest'
import { isReadingMeasureViolation } from '../../../scripts/browser-quality-rules.mjs'

describe('reading measure gate', () => {
  it('does not mistake a short label in a wide container for long prose', () => {
    expect(isReadingMeasureViolation(18, 140)).toBe(false)
  })

  it('flags prose that can render beyond the maximum reading measure', () => {
    expect(isReadingMeasureViolation(240, 96)).toBe(true)
  })
})
