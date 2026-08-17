import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  isLowConfidenceResolution,
  listIndustries,
  matchServiceDef,
  resolveIndustrySlug,
} from '@/lib/catalog/serviceCatalog'

/**
 * Catalog coverage, measured instead of assumed.
 *
 * The fixture is every service category Angi's directory listed on 2026-08-16 —
 * 887 of them, the closest thing to a canonical list of what a home-services
 * business might call itself. Each one is put through the real intake path
 * (isLowConfidenceResolution → resolveIndustrySlug → matchServiceDef), not a
 * lookalike, so this measures what a client typing that phrase actually gets.
 *
 * Before this suite existed the numbers were 61% fully matched and 20% with no
 * signal at all, and nothing in CI would have noticed either way. The floors
 * below are ratchets: they may be raised when coverage improves, and a change
 * that drops a trade back out of the catalog fails here rather than shipping.
 *
 * The three outcomes are genuinely different products, which is why they are
 * asserted separately:
 *   - fully matched  → right industry AND a named service: correct pricing,
 *                      widget category and imagery.
 *   - industry only  → right vertical, generic service handling. Expected for
 *                      the categories that ARE just an industry name ("Plumbing",
 *                      "Roofers"), not a job.
 *   - no signal      → falls through to the AI custom-industry path. Should be
 *                      zero for a directory of ordinary home services.
 */

const CATEGORIES = readFileSync(
  join(__dirname, '__fixtures__', 'angi-categories.txt'),
  'utf8'
)
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)

type Outcome = 'matched' | 'industry-only' | 'unresolved'

function classify(label: string): { outcome: Outcome; industry: string | null } {
  if (isLowConfidenceResolution({ industry: label, services: [label] })) {
    return { outcome: 'unresolved', industry: null }
  }
  const industry = resolveIndustrySlug({ industry: label, services: [label] })
  return { outcome: matchServiceDef(label) ? 'matched' : 'industry-only', industry }
}

const RESULTS = CATEGORIES.map((label) => ({ label, ...classify(label) }))
const count = (outcome: Outcome) => RESULTS.filter((r) => r.outcome === outcome).length

describe('Angi directory coverage', () => {
  it('has the full fixture', () => {
    expect(CATEGORIES.length).toBe(887)
  })

  it('leaves no category without any signal', () => {
    const unresolved = RESULTS.filter((r) => r.outcome === 'unresolved').map((r) => r.label)
    expect(unresolved).toEqual([])
  })

  it('fully matches at least 655 categories to an industry and a service', () => {
    // Ratchet: raise this when coverage improves, never lower it to make a
    // change pass. 660 at the time of writing.
    expect(count('matched')).toBeGreaterThanOrEqual(655)
  })

  it('never answers a real trade with the zero-signal fallback', () => {
    const fellBack = RESULTS.filter((r) => r.industry === 'generic-trade').map((r) => r.label)
    expect(fellBack).toEqual([])
  })

  it('keeps every industry deep enough to describe a business in it', () => {
    // The depth floor from the coverage plan, now universal: the catalog went
    // from a median of 4 services and 23 industries at three or fewer, to 8
    // everywhere. A vertical with three services cannot carry a real site.
    const belowFloor = listIndustries()
      .filter((i) => i.services.length < 8)
      .map((i) => `${i.slug} (${i.services.length})`)
    expect(belowFloor).toEqual([])
  })

  it('spreads coverage across the catalog rather than into a few buckets', () => {
    const industries = new Set(RESULTS.map((r) => r.industry).filter(Boolean))
    expect(industries.size).toBeGreaterThanOrEqual(60)
  })
})
