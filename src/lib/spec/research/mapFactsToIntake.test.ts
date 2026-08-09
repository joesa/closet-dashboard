import { describe, expect, it } from 'vitest'
import { hasProprietaryDetail, mapFactsToIntake } from '@/lib/spec/research/mapFactsToIntake'
import type { SpecBuildLeadInput, SpecFact } from '@/lib/spec/types'

const LEAD: SpecBuildLeadInput = {
  businessName: "CC's Lawn Service",
  phone: '+19314367322',
  services: ['Lawn care service'],
  city: 'Clarksville',
  email: 'chris7771988@ymail.com',
  businessCategory: 'Lawn care service',
  address: '8428 Rivermont Dr, Clarksville, TN 37043',
}

const PLACEHOLDER = 'spec+abc123@ditchtheform.com'
const map = (facts: SpecFact[]) =>
  mapFactsToIntake(LEAD, facts, { placeholderEmail: PLACEHOLDER })

const fact = (over: Partial<SpecFact>): SpecFact => ({
  field: 'notes',
  value: 'v',
  evidence: 'v',
  sourceUrl: 'https://example.com',
  sourceKind: 'maps_listing',
  capturedAt: '2026-08-08T00:00:00Z',
  verbatim: true,
  ...over,
})

describe('mapFactsToIntake — contact details', () => {
  it('never puts the owner’s real email on the intake', () => {
    // provisionTenant creates an auth user and emails credentials to
    // contact_email. Using their real address would sign somebody up for an
    // account they never asked for, before they have heard of us.
    const { patch } = map([])
    expect(patch.contact_email).toBe(PLACEHOLDER)
    expect(patch.notification_email).toBe(PLACEHOLDER)
    expect(JSON.stringify(patch)).not.toContain('chris7771988@ymail.com')
  })

  it('marks the row as a waived-deposit AI Premium spec build', () => {
    const { patch } = map([])
    expect(patch.source).toBe('spec')
    expect(patch.intake_tier).toBe('ai_premium')
    expect(patch.deposit_status).toBe('waived')
    expect(patch.deposit_required_cents).toBe(0)
  })

  it('falls back to parsing the city out of the address', () => {
    const { patch } = mapFactsToIntake({ ...LEAD, city: null }, [], {
      placeholderEmail: PLACEHOLDER,
    })
    expect(patch.address_locality).toBe('Clarksville')
  })
})

describe('mapFactsToIntake — taste columns stay empty', () => {
  it('leaves self-description NULL rather than inventing it', () => {
    // A cold lead has told us none of this. Guessing produces a site that
    // describes a business that does not exist.
    const { patch } = map([])
    for (const field of [
      'vibe',
      'tone',
      'customers',
      'experience',
      'differentiators',
      'primary_cta',
      'pricing_notes',
    ]) {
      expect(patch[field], `${field} must not be invented`).toBeUndefined()
    }
  })
})

describe('mapFactsToIntake — fact placement', () => {
  it('places a verbatim craft fact and formats quotes for the brief', () => {
    const { patch } = map([
      fact({ field: 'shop_rule', value: 'We only use Scotts Turf Builder on fescue' }),
      fact({
        field: 'customer_quotes',
        value: 'They edged around my septic lids without me asking twice.',
        sourceKind: 'maps_review',
      }),
    ])

    expect(patch.shop_rule).toBe('We only use Scotts Turf Builder on fescue')
    expect(patch.customer_quotes).toBe(
      '"They edged around my septic lids without me asking twice."'
    )
  })

  it('keeps one fact per craft column and surfaces the rest instead of merging', () => {
    const { patch, unused } = map([
      fact({ field: 'recent_job', value: 'Regraded the Sango cul-de-sac in one day' }),
      fact({ field: 'recent_job', value: 'Rebuilt a retaining wall on Tiny Town Rd' }),
    ])

    expect(patch.recent_job).toBe('Regraded the Sango cul-de-sac in one day')
    expect(unused).toHaveLength(1)
  })

  it('splits and dedupes signature materials', () => {
    const { patch } = map([
      fact({ field: 'signature_materials', value: 'Scotts Turf Builder, fescue' }),
      fact({ field: 'signature_materials', value: 'fescue, Bermuda' }),
    ])
    expect(patch.signature_materials).toEqual(['Scotts Turf Builder', 'fescue', 'Bermuda'])
  })

  it('caps quotes and note length so the brief stays readable', () => {
    const quotes = Array.from({ length: 9 }, (_, i) =>
      fact({ field: 'customer_quotes', value: `Great work number ${i}`, sourceKind: 'maps_review' })
    )
    const { patch, unused } = map(quotes)
    expect(String(patch.customer_quotes).split('\n')).toHaveLength(4)
    expect(unused).toHaveLength(5)

    const long = map([fact({ field: 'notes', value: 'x'.repeat(5000) })])
    expect(String(long.patch.notes).length).toBeLessThanOrEqual(1200)
  })

  it('ignores facts targeting columns the lead already covers', () => {
    const { patch, unused } = map([
      fact({ field: 'business_name', value: 'Something Else LLC' }),
      fact({ field: 'industry', value: 'Roofing' }),
    ])
    expect(patch.business_name).toBe("CC's Lawn Service")
    expect(patch.industry).toBe('Lawn care service')
    expect(unused).toHaveLength(2)
  })
})

describe('hasProprietaryDetail', () => {
  it('is false for a lead with nothing but its own name and category', () => {
    // This is the Phase 0 failure mode, caught before a build is paid for.
    expect(hasProprietaryDetail(map([]).patch)).toBe(false)
  })

  it('is true once any craft fact or real review has landed', () => {
    expect(hasProprietaryDetail(map([fact({ field: 'craft_spec', value: 'Cut at 3.5 inches' })]).patch)).toBe(true)
    expect(
      hasProprietaryDetail(
        map([fact({ field: 'customer_quotes', value: 'They came back twice', sourceKind: 'maps_review' })]).patch
      )
    ).toBe(true)
    expect(
      hasProprietaryDetail(map([fact({ field: 'signature_materials', value: 'Fescue' })]).patch)
    ).toBe(true)
  })

  it('is not fooled by notes alone, which never enter the facts block', () => {
    expect(hasProprietaryDetail(map([fact({ field: 'notes', value: 'A nice company' })]).patch)).toBe(
      false
    )
  })
})
