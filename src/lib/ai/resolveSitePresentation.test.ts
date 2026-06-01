import { describe, expect, it } from 'vitest'
import {
  presentationFromIntakeRow,
  resolveSitePresentationRules,
} from '@/lib/ai/resolveSitePresentation'
import { OTHER_SERVICE_LABEL } from '@/lib/catalog/contractorServices'
import { THEME_SLUGS } from '@/lib/catalog/sitePresentationCatalog'
import { buildIntakeBrief } from '@/lib/intake/buildIntakeBrief'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'

describe('resolveSitePresentationRules', () => {
  it('prefers garage themes for garage-heavy services', () => {
    const result = resolveSitePresentationRules({
      services: ['Garages & Garage Storage', 'Garage Flooring & Slatwall Systems'],
    })
    expect(['garage-industrial', 'brutalist', 'functional-utility']).toContain(result.theme)
    expect(['visual-impact', 'conversion-focus', 'standard']).toContain(result.layoutStyle)
  })

  it('maps custom Other text to wine-leaning theme pool', () => {
    const result = resolveSitePresentationRules({
      services: [OTHER_SERVICE_LABEL],
      other_services: 'Wine cellars and tasting rooms',
    })
    expect(['sophisticated-wine', 'wine-cellar', 'rustic-pantry']).toContain(result.theme)
    expect(result.defaultRoom).toBe('Pantry & Wine')
  })

  it('includes other_services in intake brief', () => {
    const row = {
      business_name: 'Cellar Co',
      services: ['Walk-In Closets'],
      other_services: 'Custom wine racks',
    } as ProspectIntakeRow
    const brief = buildIntakeBrief(row)
    expect(brief).toContain('Custom wine racks')
    expect(presentationFromIntakeRow(row).other_services).toBe('Custom wine racks')
  })
})

describe('THEME_SLUGS catalog', () => {
  it('has 25 themes for AI pool strategy', () => {
    expect(THEME_SLUGS).toHaveLength(25)
  })
})
