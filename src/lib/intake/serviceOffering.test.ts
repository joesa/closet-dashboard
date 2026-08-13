import { describe, expect, it } from 'vitest'
import { includesServiceOffering, serviceOfferingKey } from './serviceOffering'

describe('service offering duplicate detection', () => {
  it('ignores punctuation, ampersand spelling, case, and a generic service suffix', () => {
    expect(serviceOfferingKey(' Tile & Grout Cleaning Services ')).toBe(
      serviceOfferingKey('tile and grout cleaning')
    )
  })

  it('does not collapse genuinely different offerings', () => {
    expect(includesServiceOffering(['Grout Sealing'], 'Grout Color Restoration')).toBe(false)
  })
})
