import { describe, expect, it } from 'vitest'
import { planSpecBuildEnqueue } from '@/lib/spec/enqueueFromScraperRun'
import type { ScrapedLeadShape } from '@/lib/spec/qualifyLead'

/**
 * The daily budget is the only thing standing between one scraper run and
 * hundreds of paid AI site builds. Each build costs a Sonnet site config, a
 * handful of gpt-image-1 calls, and a full multi-pass redesign, so an
 * off-by-one here is measured in dollars per lead.
 */

const b1 = (over: Partial<ScrapedLeadShape> = {}): ScrapedLeadShape => ({
  business_name: 'Test Contracting',
  phone: '(931) 555-0100',
  outreach_rank: 'B1',
  has_own_website: false,
  address: '1 Main St, Clarksville, TN 37040',
  ...over,
})

const withHomepage = () => b1({ has_own_website: true })

const pairs = (rows: ScrapedLeadShape[]) => rows.map((row, i) => ({ id: `lead-${i}`, row }))

describe('planSpecBuildEnqueue', () => {
  it('never plans more builds than the budget allows', () => {
    const plan = planSpecBuildEnqueue(pairs(Array.from({ length: 40 }, () => b1())), 5)

    expect(plan.toQueue).toHaveLength(5)
    expect(plan.capped).toBe(35)
  })

  it('plans nothing when the budget is already spent', () => {
    const plan = planSpecBuildEnqueue(pairs([b1(), b1()]), 0)
    expect(plan.toQueue).toHaveLength(0)
    expect(plan.capped).toBe(2)
  })

  it('treats a negative budget as zero rather than as unlimited', () => {
    // countSpecBuildsStartedToday can exceed the cap if it was lowered midday.
    const plan = planSpecBuildEnqueue(pairs([b1()]), -5)
    expect(plan.toQueue).toHaveLength(0)
    expect(plan.capped).toBe(1)
  })

  it('does not spend budget on leads it rejects', () => {
    // Six leads, three of them unqualified, budget of 3: all three good ones
    // must still be planned. Charging budget for a rejection would silently
    // shrink the day's real capacity.
    const plan = planSpecBuildEnqueue(
      pairs([withHomepage(), b1(), withHomepage(), b1(), withHomepage(), b1()]),
      3
    )

    expect(plan.toQueue).toHaveLength(3)
    expect(plan.unqualified).toBe(3)
    expect(plan.capped).toBe(0)
  })

  it('accounts for every lead it was given', () => {
    const rows = [b1(), withHomepage(), b1(), b1(), b1()]
    const plan = planSpecBuildEnqueue(pairs(rows), 2)
    expect(plan.toQueue.length + plan.unqualified + plan.capped).toBe(rows.length)
  })

  it('carries the scraper lead id through so provenance survives', () => {
    const plan = planSpecBuildEnqueue(pairs([b1()]), 1)
    expect(plan.toQueue[0].id).toBe('lead-0')
    expect(plan.toQueue[0].lead.qualified).toBe(true)
  })
})

describe('planSpecBuildEnqueue — Maps URL provenance', () => {
  it('carries the Maps place URL through, since scraper_leads has no column for it', () => {
    // The flattened scraper_leads row drops mapsPlaceUrl, so it must be picked
    // up at enqueue time from the raw scraped lead or it is lost for good — and
    // it is the only handle on the business's reviews.
    const plan = planSpecBuildEnqueue(
      [{ id: 'lead-0', row: b1(), mapsPlaceUrl: 'https://maps.google.com/place/x' }],
      1
    )
    expect(plan.toQueue[0].mapsPlaceUrl).toBe('https://maps.google.com/place/x')
  })

  it('tolerates a lead with no Maps URL', () => {
    const plan = planSpecBuildEnqueue([{ id: 'lead-0', row: b1() }], 1)
    expect(plan.toQueue[0].mapsPlaceUrl).toBeUndefined()
  })
})

describe('planSpecBuildEnqueue — public profile provenance', () => {
  it('carries temporary public profile research to the guarded queue boundary', () => {
    const publicProfileResearch = {
      sourceUrl: 'https://facebook.com/test-contracting',
      text: 'Temporary public business prose retained only until verified extraction completes.',
      capturedAt: '2026-08-09T00:00:00.000Z',
      captureMethod: 'public_browser',
    }
    const plan = planSpecBuildEnqueue(
      [{ id: 'lead-0', row: b1(), publicProfileResearch }],
      1
    )

    expect(plan.toQueue[0].publicProfileResearch).toBe(publicProfileResearch)
  })
})
