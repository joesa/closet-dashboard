import { describe, expect, it } from 'vitest'
import { buildIntakeBrief } from '@/lib/intake/buildIntakeBrief'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'

describe('buildIntakeBrief custom facts', () => {
  it('places custom admin facts in the sanctioned proprietary-facts block', () => {
    const row = {
      source: 'spec',
      notes: 'Keep the navigation short.\nCUSTOM FACT — Equipment maintenance interval: Every 250 hours',
      services: [],
      differentiators: [],
      signature_materials: [],
    } as unknown as ProspectIntakeRow

    const brief = buildIntakeBrief(row)
    expect(brief).toContain('Additional notes: Keep the navigation short.')
    expect(brief).toContain('PROPRIETARY FACTS')
    expect(brief).toContain('- Equipment maintenance interval: Every 250 hours')
    expect(brief).not.toContain('Additional notes: CUSTOM FACT')
  })
})
