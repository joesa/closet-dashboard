import { describe, expect, it } from 'vitest'
import {
  normalizeAdminFactField,
  normalizeForEvidence,
  verifyFacts,
} from '@/lib/spec/research/verifyFacts'
import type { SpecFact } from '@/lib/spec/types'

/**
 * These tests are the non-fabrication guarantee.
 *
 * Everything downstream — the brief, the generated copy, the site we text to a
 * real business owner — is allowed to assert only what survives this function.
 * A hole here is a site making up facts about somebody's company.
 */

const MAPS_URL = 'https://maps.google.com/place/ccs-lawn'
const FB_URL = 'https://facebook.com/ccservices84'

const MAPS_PAGE = `
CC's Lawn Service. 4.8 stars, 16 reviews. Lawn care service in Clarksville, TN.
Review from Dana R: They edged around my septic lids without me asking twice.
Review from Marcus: Showed up at 7am on a Saturday and had it done before ten.
`

const FB_PAGE = `
About: We have run the same two crews out of Sango since 2011. We only use
Scotts Turf Builder on fescue, never the cheap store brand.
`

const pages = new Map([
  [MAPS_URL, MAPS_PAGE],
  [FB_URL, FB_PAGE],
])

const fact = (over: Partial<SpecFact>): Partial<SpecFact> => ({
  field: 'notes',
  value: 'something',
  evidence: 'Lawn care service in Clarksville, TN',
  sourceUrl: MAPS_URL,
  sourceKind: 'maps_listing',
  ...over,
})

describe('verifyFacts — the fabrication guard', () => {
  it('drops a fact whose evidence is not in the page, however plausible', () => {
    // The single most important case: a model inventing a credible-sounding
    // claim about a real business.
    const result = verifyFacts(
      [
        fact({
          field: 'craft_spec',
          value: 'Family owned and operated since 1998',
          evidence: 'Family owned and operated since 1998',
        }),
      ],
      pages
    )

    expect(result.accepted).toHaveLength(0)
    expect(result.rejected[0].reason).toBe('evidence_not_found')
  })

  it('drops a fact whose evidence exists but in a different page than claimed', () => {
    // Cross-contamination: real text, wrong provenance. The source link in the
    // admin ledger has to actually lead to the claim.
    const result = verifyFacts(
      [
        fact({
          field: 'craft_spec',
          value: 'We only use Scotts Turf Builder on fescue',
          evidence: 'We only use Scotts Turf Builder on fescue',
          sourceUrl: MAPS_URL, // the text is on the Facebook page
        }),
      ],
      pages
    )

    expect(result.accepted).toHaveLength(0)
    expect(result.rejected[0].reason).toBe('evidence_not_found')
  })

  it('accepts a verbatim fact that really is in its claimed source', () => {
    const result = verifyFacts(
      [
        fact({
          field: 'craft_spec',
          value: 'We only use Scotts Turf Builder on fescue',
          evidence: 'We only use Scotts Turf Builder on fescue',
          sourceUrl: FB_URL,
          sourceKind: 'facebook_about',
        }),
      ],
      pages
    )

    expect(result.rejected).toHaveLength(0)
    expect(result.accepted[0].verbatim).toBe(true)
    expect(result.accepted[0].sourceUrl).toBe(FB_URL)
    expect(result.accepted[0].capturedAt).toBeTruthy()
  })

  it('tolerates smart quotes and whitespace but not different words', () => {
    const withTypography = verifyFacts(
      [
        fact({
          field: 'notes',
          value: 'x',
          evidence: 'Lawn  care service in Clarksville,\n TN',
        }),
      ],
      pages
    )
    expect(withTypography.accepted).toHaveLength(1)

    const reworded = verifyFacts(
      [fact({ field: 'notes', value: 'x', evidence: 'Lawn service in Clarksville, TN' })],
      pages
    )
    expect(reworded.accepted).toHaveLength(0)
  })

  it('rejects evidence too short to prove anything', () => {
    // "care" appears in the page but proves no provenance at all.
    const result = verifyFacts([fact({ evidence: 'care' })], pages)
    expect(result.rejected[0].reason).toBe('evidence_too_short')
  })

  it('rejects facts with no source URL and unknown target columns', () => {
    expect(verifyFacts([fact({ sourceUrl: '' })], pages).rejected[0].reason).toBe('no_source_url')
    expect(verifyFacts([fact({ field: 'owner_ssn' })], pages).rejected[0].reason).toBe(
      'unknown_field'
    )
    expect(verifyFacts([fact({ value: '   ' })], pages).rejected[0].reason).toBe('empty_value')
  })
})

describe('verifyFacts — testimonials', () => {
  const review = 'They edged around my septic lids without me asking twice.'

  it('accepts a verbatim Google review as a customer quote', () => {
    const result = verifyFacts(
      [
        fact({
          field: 'customer_quotes',
          value: review,
          evidence: review,
          sourceKind: 'maps_review',
        }),
      ],
      pages
    )
    expect(result.accepted).toHaveLength(1)
  })

  it('accepts a verbatim Yelp review as a customer quote', () => {
    const result = verifyFacts(
      [
        fact({
          field: 'customer_quotes',
          value: review,
          evidence: review,
          sourceKind: 'yelp_review',
        }),
      ],
      pages
    )
    expect(result.accepted).toHaveLength(1)
  })

  it('refuses a paraphrased review — that is an invented customer statement', () => {
    const result = verifyFacts(
      [
        fact({
          field: 'customer_quotes',
          value: 'They did a great job around my septic lids!',
          evidence: review,
          sourceKind: 'maps_review',
        }),
      ],
      pages
    )
    expect(result.accepted).toHaveLength(0)
    expect(result.rejected[0].reason).toBe('craft_field_not_verbatim')
  })

  it('refuses a "quote" sourced from anything other than a review', () => {
    // Owner marketing copy on their own Facebook page is not a testimonial.
    const result = verifyFacts(
      [
        fact({
          field: 'customer_quotes',
          value: 'We have run the same two crews out of Sango since 2011',
          evidence: 'We have run the same two crews out of Sango since 2011',
          sourceUrl: FB_URL,
          sourceKind: 'facebook_about',
        }),
      ],
      pages
    )
    expect(result.rejected[0].reason).toBe('quote_not_from_review')
  })
})

describe('verifyFacts — craft columns', () => {
  it('demotes a paraphrase rather than letting it pose as an owner fact', () => {
    // craft_* is the only sanctioned source of concrete claims in the brief,
    // so a summary must not be laundered into one.
    const result = verifyFacts(
      [
        fact({
          field: 'shop_rule',
          value: 'They never use cheap store-brand fertilizer',
          evidence: 'never the cheap store brand',
          sourceUrl: FB_URL,
          sourceKind: 'facebook_about',
        }),
      ],
      pages
    )
    expect(result.accepted).toHaveLength(0)
    expect(result.rejected[0].reason).toBe('craft_field_not_verbatim')
  })

  it('still allows a paraphrase into notes, which never enters the facts block', () => {
    const result = verifyFacts(
      [
        fact({
          field: 'notes',
          value: 'Runs two crews out of the Sango area.',
          evidence: 'We have run the same two crews out of Sango since 2011',
          sourceUrl: FB_URL,
          sourceKind: 'facebook_about',
        }),
      ],
      pages
    )
    expect(result.accepted).toHaveLength(1)
    expect(result.accepted[0].verbatim).toBe(false)
  })
})

describe('normalizeForEvidence', () => {
  it('folds typography a model routinely rewrites', () => {
    expect(normalizeForEvidence('We “never” cut  corners—ever')).toBe(
      'we "never" cut corners-ever'
    )
  })
})

describe('verifyFacts — contact details never travel as facts', () => {
  const PAGE_URL = 'https://maps.google.com/place/leaky'
  const page = new Map([
    [
      PAGE_URL,
      'Contact us at chris7771988@ymail.com or call (931) 436-7322. We cut fescue at 3.5 inches.',
    ],
  ])
  const withValue = (value: string): Partial<SpecFact> => ({
    field: 'notes',
    value,
    evidence: 'Contact us at chris7771988@ymail.com or call (931) 436-7322',
    sourceUrl: PAGE_URL,
    sourceKind: 'maps_listing',
  })

  it('rejects a fact carrying an email address', () => {
    // Observed for real: the extractor lifted the owner's personal email off a
    // Maps listing into notes, which feeds the brief and then the site.
    const result = verifyFacts([withValue('The business email is chris7771988@ymail.com.')], page)
    expect(result.accepted).toHaveLength(0)
    expect(result.rejected[0].reason).toBe('contains_contact_details')
  })

  it('rejects a fact carrying a phone number in any common format', () => {
    for (const phone of ['(931) 436-7322', '931-436-7322', '+1 931 436 7322', '9314367322']) {
      const result = verifyFacts([withValue(`Call them on ${phone} any time.`)], page)
      expect.soft(result.rejected[0]?.reason, phone).toBe('contains_contact_details')
    }
  })

  it('still accepts a genuine fact that merely contains a number', () => {
    const result = verifyFacts(
      [
        {
          field: 'craft_spec',
          value: 'We cut fescue at 3.5 inches',
          evidence: 'We cut fescue at 3.5 inches',
          sourceUrl: PAGE_URL,
          sourceKind: 'maps_listing',
        },
      ],
      page
    )
    expect(result.accepted).toHaveLength(1)
  })
})

describe('verifyFacts — the admin escape hatch', () => {
  // Most cold leads have nothing verifiable online, so the only route to a site
  // is a human ringing the owner. That fact has no page to check against, so it
  // is checked against a person instead.
  const adminFact = (over: Partial<SpecFact> = {}): Partial<SpecFact> => ({
    field: 'craft_spec',
    value: 'Soft-wash mix never goes above 1% sodium hypochlorite on cedar',
    sourceKind: 'admin_manual',
    note: 'Owner said so on a call, 9 Aug 2026',
    addedBy: 'admin@ditchtheform.com',
    ...over,
  })

  const noPages = new Map<string, string>()

  it('accepts an attributed admin fact with no page to verify against', () => {
    const result = verifyFacts([adminFact()], noPages)

    expect(result.rejected).toHaveLength(0)
    expect(result.accepted).toHaveLength(1)
    expect(result.accepted[0].sourceKind).toBe('admin_manual')
    expect(result.accepted[0].addedBy).toBe('admin@ditchtheform.com')
    // Authoritative as typed, so it can fill a craft_* column — the whole point.
    expect(result.accepted[0].verbatim).toBe(true)
    // The note becomes the evidence a reviewer reads to decide whether to believe it.
    expect(result.accepted[0].evidence).toBe('Owner said so on a call, 9 Aug 2026')
  })

  it('accepts a safe custom admin fact kind and keeps its human label', () => {
    const field = normalizeAdminFactField('Equipment maintenance interval')
    expect(field).toBe('custom:Equipment maintenance interval')

    const result = verifyFacts([adminFact({ field: field! })], noPages)
    expect(result.rejected).toHaveLength(0)
    expect(result.accepted[0].field).toBe(field)
  })

  it('does not let custom kinds disguise testimonials', () => {
    expect(normalizeAdminFactField('Customer review')).toBeNull()
    expect(normalizeAdminFactField('Testimonials')).toBeNull()
  })

  it('refuses an admin fact with no source note — that is just an assertion', () => {
    expect(verifyFacts([adminFact({ note: '' })], noPages).rejected[0].reason).toBe(
      'admin_fact_needs_source_note'
    )
    expect(verifyFacts([adminFact({ note: 'owner' })], noPages).rejected[0].reason).toBe(
      'admin_fact_needs_source_note'
    )
  })

  it('refuses an unattributed admin fact', () => {
    // Without a name on it, an admin fact is indistinguishable from an invented one.
    expect(verifyFacts([adminFact({ addedBy: '' })], noPages).rejected[0].reason).toBe(
      'admin_fact_needs_attribution'
    )
  })

  it('never lets an admin write a testimonial', () => {
    // An admin can authorise the business's own claims. Nobody can vouch for
    // what somebody else's customer said.
    const result = verifyFacts(
      [adminFact({ field: 'customer_quotes', value: 'Best pressure washing in Clarksville!' })],
      noPages
    )
    expect(result.accepted).toHaveLength(0)
    expect(result.rejected[0].reason).toBe('quote_not_from_review')
  })

  it('still refuses contact details and unknown columns from an admin', () => {
    expect(
      verifyFacts([adminFact({ value: 'Call the owner on (931) 436-7322' })], noPages).rejected[0]
        .reason
    ).toBe('contains_contact_details')
    expect(verifyFacts([adminFact({ field: 'owner_ssn' })], noPages).rejected[0].reason).toBe(
      'unknown_field'
    )
  })

  it('does not let a scraped fact skip verification by claiming to be admin-entered', () => {
    // The bypass keys off sourceKind, so a page-sourced fact must not be able to
    // borrow it without the note and attribution that justify the bypass.
    const smuggled = verifyFacts(
      [{ field: 'craft_spec', value: 'Invented claim', sourceKind: 'admin_manual' }],
      noPages
    )
    expect(smuggled.accepted).toHaveLength(0)
  })
})
