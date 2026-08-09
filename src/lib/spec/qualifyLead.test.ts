import { afterEach, describe, expect, it } from 'vitest'
import { cityFromAddress, qualifyLeadForSpecBuild } from '@/lib/spec/qualifyLead'
import {
  SPEC_BUILD_CLOSED_STATUSES,
  SPEC_BUILD_IN_FLIGHT_STATUSES,
  SPEC_BUILD_STATUSES,
} from '@/lib/spec/types'

/**
 * Qualification decides what we spend money on. A false positive is a wasted
 * build plus an unsolicited text to a business that already has a website.
 */

// A real PIPELINE_B / B1 row, shaped as the scraper stores it in scraper_leads.
const B1_LEAD = {
  business_name: "CC's Lawn Service",
  phone: '(931) 436-7322',
  email: 'chris7771988@ymail.com',
  website: null,
  address: '8428 Rivermont Dr, Clarksville, TN 37043',
  pipeline: 'PIPELINE_B',
  outreach_rank: 'B1',
  has_own_website: false,
  business_category: 'Lawn care service',
  services_provided: ['Lawn care service'],
  social_profile_url: 'http://www.facebook.com/ccservices84/',
}

afterEach(() => {
  delete process.env.SPEC_BUILD_MAX_SERVICES
})

describe('qualifyLeadForSpecBuild', () => {
  it('accepts a B1 lead and normalises its phone to E.164', () => {
    const result = qualifyLeadForSpecBuild(B1_LEAD)
    expect(result.qualified).toBe(true)
    if (!result.qualified) return

    expect(result.lead.phone).toBe('+19314367322')
    expect(result.lead.businessName).toBe("CC's Lawn Service")
    expect(result.lead.city).toBe('Clarksville')
    expect(result.lead.services).toEqual(['Lawn care service'])
  })

  it('rejects a business that already has a website', () => {
    expect(qualifyLeadForSpecBuild({ ...B1_LEAD, has_own_website: true })).toMatchObject({
      qualified: false,
      reason: 'has_own_website',
    })
    // has_own_website can be stale; a website URL is the stronger signal.
    expect(
      qualifyLeadForSpecBuild({ ...B1_LEAD, website: 'https://ccslawn.com' })
    ).toMatchObject({ qualified: false, reason: 'has_own_website' })
  })

  it('rejects B2 — a site that merely failed to load is still a site', () => {
    expect(qualifyLeadForSpecBuild({ ...B1_LEAD, outreach_rank: 'B2' })).toMatchObject({
      qualified: false,
    })
  })

  it('rejects pipeline A leads and leads with no rank', () => {
    expect(qualifyLeadForSpecBuild({ ...B1_LEAD, outreach_rank: 'A1' }).qualified).toBe(false)
    expect(qualifyLeadForSpecBuild({ ...B1_LEAD, outreach_rank: null }).qualified).toBe(false)
  })

  it('rejects a lead we could never text, however good it otherwise looks', () => {
    expect(qualifyLeadForSpecBuild({ ...B1_LEAD, phone: null })).toMatchObject({
      qualified: false,
      reason: 'no_phone',
    })
    expect(qualifyLeadForSpecBuild({ ...B1_LEAD, phone: '555' })).toMatchObject({
      qualified: false,
      reason: 'no_phone',
    })
  })

  it('rejects a nameless lead', () => {
    expect(qualifyLeadForSpecBuild({ ...B1_LEAD, business_name: '  ' })).toMatchObject({
      qualified: false,
      reason: 'no_business_name',
    })
  })

  it('clamps services, dedupes case-insensitively, and falls back to categories', () => {
    process.env.SPEC_BUILD_MAX_SERVICES = '2'
    const clamped = qualifyLeadForSpecBuild({
      ...B1_LEAD,
      services_provided: ['Mowing', 'mowing', 'Edging', 'Mulching', 'Leaf removal'],
    })
    expect(clamped.qualified && clamped.lead.services).toEqual(['Mowing', 'Edging'])

    const fromCategories = qualifyLeadForSpecBuild({
      ...B1_LEAD,
      services_provided: [],
      business_category: 'Roofing contractor',
      additional_categories: ['Gutter service'],
    })
    expect(fromCategories.qualified && fromCategories.lead.services).toEqual([
      'Roofing contractor',
      'Gutter service',
    ])
  })
})

describe('cityFromAddress', () => {
  it('pulls the locality out of a full US address', () => {
    expect(cityFromAddress('8428 Rivermont Dr, Clarksville, TN 37043')).toBe('Clarksville')
  })

  it('returns null rather than guessing on a partial address', () => {
    // A wrong city ends up in generated site copy, so no guess beats a bad one.
    expect(cityFromAddress('Tiny Town Rd')).toBeNull()
    expect(cityFromAddress('Clarksville, TN')).toBeNull()
    expect(cityFromAddress(null)).toBeNull()
    expect(cityFromAddress('   ')).toBeNull()
  })
})

describe('spec build status sets', () => {
  it('keeps the closed set in sync with the partial unique index in the migration', () => {
    // The migration's idx_spec_builds_live_phone excludes exactly these. If the
    // two drift, a closed lead either can never be requeued or is queued twice.
    expect([...SPEC_BUILD_CLOSED_STATUSES].sort()).toEqual(
      ['declined', 'expired', 'purged', 'rejected'].sort()
    )
  })

  it('declares every in-flight and closed status as a real status', () => {
    for (const status of [...SPEC_BUILD_IN_FLIGHT_STATUSES, ...SPEC_BUILD_CLOSED_STATUSES]) {
      expect(SPEC_BUILD_STATUSES).toContain(status)
    }
  })
})
