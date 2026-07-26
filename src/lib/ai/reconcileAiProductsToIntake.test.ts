import { describe, expect, it } from 'vitest'
import {
  reconcileAiProductsToIntake,
  scoreServiceTitleMatch,
} from './reconcileAiProductsToIntake'

describe('scoreServiceTitleMatch', () => {
  it('scores exact and near matches highly', () => {
    expect(scoreServiceTitleMatch('Collision Repair', 'Collision Repair')).toBe(100)
    expect(
      scoreServiceTitleMatch('Auto Painting', 'Custom Auto Painting & Color Matching')
    ).toBeGreaterThanOrEqual(80)
  })

  it('does not match wrapping to painting', () => {
    expect(
      scoreServiceTitleMatch('Auto Wrapping', 'Custom Auto Painting & Color Matching')
    ).toBeLessThan(40)
  })
})

describe('reconcileAiProductsToIntake', () => {
  it('keeps every intake title when AI collapses to four products', () => {
    const intake = [
      'Collision Repair',
      'Auto Painting',
      'Paintless Dent Repair (PDR)',
      'Scratch & Chip Repair',
      'Frame & Structural Repair',
      'Bumper Repair & Replacement',
      'Glass & Windshield',
      'Auto Wrapping',
      'Collision & Structural Frame Repair',
      'Auto Painting & Custom Wrapping',
      'Bumper & Auto Glass Replacement',
      'Paintless Dent & Scratch Repair',
    ]
    const ai = [
      { title: 'Collision Repair', description: 'Collision copy' },
      {
        title: 'Custom Auto Painting & Color Matching',
        description: 'Paint copy',
      },
      { title: 'Paintless Dent Repair', description: 'Dent copy' },
      { title: 'Bumper Repair & Replacement', description: 'Bumper copy' },
    ]

    const out = reconcileAiProductsToIntake(intake, ai)
    expect(out).toHaveLength(12)
    expect(out.map((p) => p.title)).toEqual(intake)
    expect(out.find((p) => p.title === 'Auto Wrapping')).toBeTruthy()
    expect(out.find((p) => p.title === 'Auto Wrapping')?.description).toMatch(
      /Auto Wrapping/
    )
    expect(out.find((p) => p.title === 'Collision Repair')?.description).toBe(
      'Collision copy'
    )
    expect(out.find((p) => p.title === 'Auto Painting')?.description).toBe(
      'Paint copy'
    )
  })

  it('returns stubs when AI products are missing', () => {
    const out = reconcileAiProductsToIntake(['Auto Wrapping', 'Glass & Windshield'], null)
    expect(out).toHaveLength(2)
    expect(out[0].title).toBe('Auto Wrapping')
    expect(out[0].description).toBeTruthy()
  })
})
