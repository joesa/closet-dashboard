import { describe, expect, it } from 'vitest'
import { getBeforeAfterCategory, type BeforeAfterCategory } from '@/lib/openai-images'
import { INDUSTRIES } from '@/lib/catalog/industries/index'

const VALID_CATEGORIES: BeforeAfterCategory[] = ['vehicle', 'exterior', 'fixture', 'pet', 'interior-space', 'not-applicable']

describe('before/after subject category catalog coverage', () => {
  it('assigns an explicit, valid category to every catalog industry', () => {
    // This is a human-readable backstop for the TypeScript-level guarantee:
    // INDUSTRY_BEFORE_AFTER_CATEGORY in openai-images.ts is typed as
    // Record<IndustrySlug, BeforeAfterCategory> (exhaustive), so a missing
    // entry already fails `npm run build`/tsc. This test exists so the failure
    // is also visible from `npx vitest run` and documents the intent inline.
    for (const industry of INDUSTRIES) {
      const category = getBeforeAfterCategory(industry.slug)
      expect(category, `industry "${industry.slug}" has no before/after category`).toBeDefined()
      expect(VALID_CATEGORIES).toContain(category)
    }
  })

  it('pins a few known categories as a regression check', () => {
    expect(getBeforeAfterCategory('pet-services')).toBe('pet')
    expect(getBeforeAfterCategory('mobile-auto')).toBe('vehicle')
    expect(getBeforeAfterCategory('auto-body')).toBe('vehicle')
    expect(getBeforeAfterCategory('roofing')).toBe('exterior')
    expect(getBeforeAfterCategory('plumbing')).toBe('fixture')
    expect(getBeforeAfterCategory('custom-closets')).toBe('interior-space')
    // Direct-purchase/order and pure professional-service industries have no
    // physical "before" state — before/after is skipped entirely for these.
    expect(getBeforeAfterCategory('restaurants-bars')).toBe('not-applicable')
    expect(getBeforeAfterCategory('legal-services')).toBe('not-applicable')
  })
})
