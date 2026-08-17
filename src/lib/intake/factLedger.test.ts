import { describe, expect, it } from 'vitest'
import {
  buildFactLedger,
  FACT_LEDGER_VERSION,
  parseFactLedger,
  renderFactsBrief,
  sanctionedFacts,
} from '@/lib/intake/factLedger'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'

function row(overrides: Partial<ProspectIntakeRow> = {}): ProspectIntakeRow {
  return {
    business_name: "Alvarado's Tile",
    industry: 'Tile & Grout Cleaning',
    service_area: 'Clarksville and Middle Tennessee',
    address_locality: 'Clarksville',
    address_region: 'TN',
    services: ['Tile & Grout Cleaning', 'Grout Sealing'],
    other_services: 'shower restoration',
    craft_spec: 'We check grout porosity before picking chemistry.',
    shop_rule: 'We never seal a damp joint.',
    local_conditions: 'Clay soil tracks in and stains light grout.',
    customer_quotes: 'They came back the next day to seal. — R. Hill',
    ...overrides,
  } as unknown as ProspectIntakeRow
}

describe('buildFactLedger', () => {
  it('records owner-typed facts with their labels', () => {
    const ledger = buildFactLedger(row())
    expect(ledger.version).toBe(FACT_LEDGER_VERSION)
    const rule = ledger.facts.find((f) => f.key === 'shop_rule')
    expect(rule).toMatchObject({
      value: 'We never seal a damp joint.',
      provenance: 'owner_typed',
    })
    expect(ledger.profile.find((f) => f.key === 'business_name')?.value).toBe("Alvarado's Tile")
    expect(ledger.services.offered).toEqual(['Tile & Grout Cleaning', 'Grout Sealing'])
  })

  it('marks unedited AI suggestions instead of dropping them', () => {
    const ledger = buildFactLedger(row(), { suggestedFields: ['shopRule'] })
    const rule = ledger.facts.find((f) => f.key === 'shop_rule')
    // The value survives for admin review …
    expect(rule?.value).toBe('We never seal a damp joint.')
    expect(rule?.provenance).toBe('ai_suggested_unedited')
    // … but it is not a fact about this business.
    expect(sanctionedFacts(ledger).some((f) => f.key === 'shop_rule')).toBe(false)
  })

  it('never hands an unedited suggestion to a generator', () => {
    const brief = renderFactsBrief(
      buildFactLedger(row(), { suggestedFields: ['shopRule', 'craftSpec'] })
    )
    expect(brief).not.toContain('never seal a damp joint')
    expect(brief).not.toContain('grout porosity')
    // Facts the owner actually typed still make it through.
    expect(brief).toContain('Clay soil tracks in')
  })

  it('lifts CUSTOM FACT lines out of notes', () => {
    const ledger = buildFactLedger(
      row({ notes: 'general chatter\nCUSTOM FACT — Two trucks, both with 400psi machines.' })
    )
    expect(ledger.facts.some((f) => f.value.includes('400psi'))).toBe(true)
  })

  it('carries verbatim quotes and the never-invent instruction', () => {
    const brief = renderFactsBrief(buildFactLedger(row()))
    expect(brief).toContain('R. Hill')
    expect(brief).toContain('verbatim, owner-supplied')
  })

  it('renders nothing for a missing ledger', () => {
    expect(renderFactsBrief(null)).toBe('')
  })

  it('round-trips through JSONB storage', () => {
    const ledger = buildFactLedger(row())
    const parsed = parseFactLedger(JSON.parse(JSON.stringify(ledger)))
    expect(parsed?.facts.length).toBe(ledger.facts.length)
    expect(renderFactsBrief(parsed)).toBe(renderFactsBrief(ledger))
  })

  it('tolerates a garbage stored value', () => {
    expect(parseFactLedger(null)).toBeNull()
    expect(parseFactLedger({ facts: 'nope' })).toBeNull()
  })
})
