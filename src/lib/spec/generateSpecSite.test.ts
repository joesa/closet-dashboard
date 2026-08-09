import { describe, expect, it } from 'vitest'
import { normalizeAiPagesConfig, RECOMMENDED_PAGE_SLUGS } from '@/lib/catalog/sitePages'

/**
 * The page-count trap.
 *
 * `normalizeAiPagesConfig` maps over the REQUESTED slugs and looks each one up
 * in the generated set — it does not take the generated pages as given. So an
 * intake with no `requested_pages` provisions a site with zero pages no matter
 * how many the model wrote. A human prospect always picks pages in the form, so
 * this only bites the unattended path, and only after the whole build has been
 * paid for.
 */
const GENERATED = [
  { slug: '/about', title: 'About', hero: { headline: 'x' } },
  { slug: '/services', title: 'Services', hero: { headline: 'y' } },
  { slug: '/contact', title: 'Contact', hero: { headline: 'z' } },
]

describe('spec build page selection', () => {
  it('provisions NO pages when requested_pages is empty, however many were generated', () => {
    // The bug, pinned so nobody removes the fix believing it redundant.
    expect(normalizeAiPagesConfig(GENERATED, [], 'ai_premium')).toHaveLength(0)
  })

  it('provisions pages once the recommended set is seeded', () => {
    const pages = normalizeAiPagesConfig(GENERATED, [...RECOMMENDED_PAGE_SLUGS], 'ai_premium')
    expect(pages.length).toBeGreaterThan(0)
    // Output carries a leading slash; the catalog and requested_pages do not.
    expect(pages.map((p) => p.slug)).toEqual(expect.arrayContaining(['/about', '/services']))
  })

  it('keeps the model’s own page choices when they are seeded alongside the floor', () => {
    // AI Premium exists to let the model decide what pages this business needs;
    // clamping to only the recommended four would throw that judgement away.
    const withExtras = normalizeAiPagesConfig(
      [...GENERATED, { slug: '/faq', title: 'FAQ', hero: { headline: 'q' } }],
      [...RECOMMENDED_PAGE_SLUGS, 'faq'],
      'ai_premium'
    )
    expect(withExtras.map((p) => p.slug)).toContain('/faq')
  })
})
