import { describe, expect, it } from 'vitest'
import { validateGeneratedUnits } from './generatedContentQuality'

describe('validateGeneratedUnits', () => {
  it('reports the exact failed unit while allowing clean siblings', () => {
    const report = validateGeneratedUnits({
      stage: 'intake.craft-suggestions',
      profile: 'label',
      units: [
        { id: 'craftSpec', text: 'Elevate every patient visit.' },
        { id: 'timelineFacts', text: 'Same-day visits before 4 p.m.' },
      ],
    })

    expect(report.failedUnitIds).toEqual(['craftSpec'])
    expect(report.findings[0]).toEqual(expect.objectContaining({
      stage: 'intake.craft-suggestions',
      unitId: 'craftSpec',
      code: 'copy_ai_tell_phrase',
    }))
  })

  it('blocks document-style labels even when they are short', () => {
    const report = validateGeneratedUnits({
      stage: 'intake.page-copy',
      profile: 'label',
      units: [{ id: 'services.cta', text: 'View Protocol' }],
    })
    expect(report.failedUnitIds).toEqual(['services.cta'])
    expect(report.findings[0]?.code).toBe('spec_sheet_cta')
  })
})