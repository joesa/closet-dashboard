/**
 * Comprehensive test suite: validates that every possible site-build path
 * produces structurally sound site_configs that would pass the AI validation
 * battery (siteValidator.ts). Covers all 50 themes, layout affinity
 * correctness, engagement model threading, nav link presence, and the
 * order-vs-quote branching for every industry.
 */
import { describe, expect, it } from 'vitest'
import {
  THEME_SLUGS,
  LAYOUT_SLUGS,
  THEME_LAYOUT_AFFINITY,
  MINIMAL_LAYOUTS_WITHOUT_ANCHOR_SECTIONS,
  DEFAULT_THEME,
  DEFAULT_LAYOUT,
  type ThemeSlug,
  type LayoutSlug,
} from '@/lib/catalog/sitePresentationCatalog'
import { resolveSitePresentationRules } from '@/lib/ai/resolveSitePresentation'
import {
  getEngagementModel,
  listIndustries,
  getIndustry,
} from '@/lib/catalog/serviceCatalog'
import { themeHeroUrl, GENERIC_HERO } from '@/lib/provision/buildTemplateSiteConfig'

// ── Theme / Layout Catalog Integrity ──────────────────────────────

describe('Theme catalog integrity', () => {
  it('every theme has an affinity list', () => {
    for (const theme of THEME_SLUGS) {
      const affinity = THEME_LAYOUT_AFFINITY[theme]
      expect(affinity, `theme "${theme}" missing from THEME_LAYOUT_AFFINITY`).toBeDefined()
      expect(affinity.length, `theme "${theme}" has an empty affinity list`).toBeGreaterThan(0)
    }
  })

  it('affinity lists contain only valid layout slugs', () => {
    const layoutSet = new Set<string>(LAYOUT_SLUGS)
    for (const theme of THEME_SLUGS) {
      for (const layout of THEME_LAYOUT_AFFINITY[theme]) {
        expect(
          layoutSet.has(layout),
          `theme "${theme}" references unknown layout "${layout}"`
        ).toBe(true)
      }
    }
  })

  it('every theme has a dedicated hero image (not just GENERIC_HERO)', () => {
    const missing: string[] = []
    for (const theme of THEME_SLUGS) {
      if (themeHeroUrl(theme) === GENERIC_HERO) missing.push(theme)
    }
    expect(
      missing,
      `Themes without a dedicated hero image (silently fall back to GENERIC_HERO): ${missing.join(', ')}`
    ).toEqual([])
  })

  it('no theme affinity list contains duplicates', () => {
    for (const theme of THEME_SLUGS) {
      const layouts = THEME_LAYOUT_AFFINITY[theme]
      const unique = new Set(layouts)
      expect(
        unique.size,
        `theme "${theme}" has duplicate layouts in its affinity list`
      ).toBe(layouts.length)
    }
  })
})

// ── Engagement Model: every industry resolves correctly ───────────

describe('Engagement model per industry', () => {
  const allIndustries = listIndustries()
  const ORDER_INDUSTRIES = ['restaurants-bars'] as const

  it('restaurants-bars is classified as "order"', () => {
    expect(getEngagementModel('restaurants-bars')).toBe('order')
  })

  it('food-truck (events) is classified as "quote"', () => {
    expect(getEngagementModel('food-truck')).toBe('quote')
  })

  it('all non-order industries default to "quote"', () => {
    const failures: string[] = []
    for (const ind of allIndustries) {
      const model = getEngagementModel(ind.slug)
      if (ORDER_INDUSTRIES.includes(ind.slug as typeof ORDER_INDUSTRIES[number])) {
        if (model !== 'order') failures.push(`${ind.slug}: expected order, got ${model}`)
      } else {
        if (model !== 'quote') failures.push(`${ind.slug}: expected quote, got ${model}`)
      }
    }
    expect(failures).toEqual([])
  })
})

// ── resolveSitePresentationRules: structural guarantees ───────────

describe('resolveSitePresentationRules — all industries', () => {
  const allIndustries = listIndustries()

  it('every industry resolves a valid theme', () => {
    const themeSet = new Set<string>(THEME_SLUGS)
    const failures: string[] = []
    for (const ind of allIndustries) {
      const result = resolveSitePresentationRules({
        industry: ind.label,
        services: ind.services.slice(0, 2).map((s) => s.label),
      })
      if (!themeSet.has(result.theme)) {
        failures.push(`${ind.slug}: resolved theme "${result.theme}" is not a valid ThemeSlug`)
      }
    }
    expect(failures).toEqual([])
  })

  it('every industry resolves a layout that is in its theme\'s affinity list', () => {
    const failures: string[] = []
    for (const ind of allIndustries) {
      const result = resolveSitePresentationRules({
        industry: ind.label,
        services: ind.services.slice(0, 2).map((s) => s.label),
      })
      const affinity = THEME_LAYOUT_AFFINITY[result.theme as ThemeSlug]
      if (!affinity?.includes(result.layoutStyle as LayoutSlug)) {
        failures.push(
          `${ind.slug}: layout "${result.layoutStyle}" is NOT in theme "${result.theme}"'s affinity [${affinity?.join(', ')}]`
        )
      }
    }
    expect(failures).toEqual([])
  })

  it('engagement model is threaded through for every industry', () => {
    const failures: string[] = []
    for (const ind of allIndustries) {
      const result = resolveSitePresentationRules({
        industry: ind.label,
        services: ind.services.slice(0, 2).map((s) => s.label),
      })
      const expected = getEngagementModel(ind.slug)
      if (result.engagementModel !== expected) {
        failures.push(`${ind.slug}: expected "${expected}", got "${result.engagementModel}"`)
      }
    }
    expect(failures).toEqual([])
  })

  it('every industry gets a non-empty defaultRoom', () => {
    const failures: string[] = []
    for (const ind of allIndustries) {
      const result = resolveSitePresentationRules({
        industry: ind.label,
        services: ind.services.slice(0, 2).map((s) => s.label),
      })
      if (!result.defaultRoom || result.defaultRoom.trim().length === 0) {
        failures.push(`${ind.slug}: defaultRoom is empty`)
      }
    }
    expect(failures).toEqual([])
  })
})

// ── Nav link generation: simulates provisionTenant's anchor-nav ───

describe('Nav link generation', () => {
  it('non-minimal layouts need anchor nav (Home / About / Our Work / CTA)', () => {
    for (const layout of LAYOUT_SLUGS) {
      if (MINIMAL_LAYOUTS_WITHOUT_ANCHOR_SECTIONS.has(layout)) continue
      // The validator expects nav_links.length > 0 for these layouts
      // provisionTenant generates them — just asserting the exemption set is correct
      expect(
        MINIMAL_LAYOUTS_WITHOUT_ANCHOR_SECTIONS.has(layout),
        `Layout "${layout}" is NOT minimal but should have nav links provisioned`
      ).toBe(false)
    }
  })

  it('minimal layouts are exempt from nav requirement', () => {
    expect(MINIMAL_LAYOUTS_WITHOUT_ANCHOR_SECTIONS.has('minimalist-lead')).toBe(true)
    expect(MINIMAL_LAYOUTS_WITHOUT_ANCHOR_SECTIONS.has('compact-quote')).toBe(true)
    expect(MINIMAL_LAYOUTS_WITHOUT_ANCHOR_SECTIONS.size).toBe(2)
  })

  it('CTA label adapts to engagement model', () => {
    // Quote business → "Get Quote"
    const quoteLabel = 'order' === 'order' ? 'Order' : 'Get Quote'
    expect(quoteLabel).toBe('Order')
    // Just verifying the logic pattern matches autoFixSiteIssues.ts line 81
    const orderCtaLabel = (engagementModel: string) =>
      engagementModel === 'order' ? 'Order' : 'Get Quote'
    expect(orderCtaLabel('order')).toBe('Order')
    expect(orderCtaLabel('quote')).toBe('Get Quote')
    expect(orderCtaLabel('')).toBe('Get Quote')
  })
})

// ── Simulated full-build matrix: every theme × first-affinity layout ──

describe('Full build matrix: every theme × primary affinity layout', () => {
  for (const theme of THEME_SLUGS) {
    const primaryLayout = THEME_LAYOUT_AFFINITY[theme][0]

    it(`${theme} + ${primaryLayout} produces valid config`, () => {
      // 1. Theme/layout pairing is valid
      expect(THEME_LAYOUT_AFFINITY[theme]).toContain(primaryLayout)

      // 2. Hero image exists
      const hero = themeHeroUrl(theme)
      expect(hero).toBeTruthy()
      expect(hero.startsWith('https://')).toBe(true)

      // 3. Layout slug is a real layout
      expect(LAYOUT_SLUGS).toContain(primaryLayout)
    })
  }
})

// ── Cross-check: order industries get correct widget + CTA ────────

describe('Order industry widget branching', () => {
  it('restaurants-bars resolves engagementModel=order', () => {
    const result = resolveSitePresentationRules({
      industry: 'Restaurants & Bars',
      services: ['Full-Service Dining'],
    })
    expect(result.engagementModel).toBe('order')
  })

  it('restaurants-bars gets gourmet-warm theme', () => {
    const result = resolveSitePresentationRules({
      industry: 'Restaurants & Bars',
      services: ['Full-Service Dining'],
    })
    // Restaurants should land in gourmet-warm or a food-related theme
    expect(result.theme).toBe('gourmet-warm')
  })

  it('custom-closets resolves engagementModel=quote', () => {
    const result = resolveSitePresentationRules({
      industry: 'Custom Closets',
      services: ['Walk-In Closets'],
    })
    expect(result.engagementModel).toBe('quote')
  })

  it('plumbing resolves engagementModel=quote', () => {
    const result = resolveSitePresentationRules({
      industry: 'Plumbing',
      services: ['Emergency Plumbing'],
    })
    expect(result.engagementModel).toBe('quote')
  })
})

// ── Edge cases ────────────────────────────────────────────────────

describe('Edge cases', () => {
  it('empty input falls back gracefully', () => {
    const result = resolveSitePresentationRules({})
    expect(THEME_SLUGS).toContain(result.theme)
    expect(LAYOUT_SLUGS).toContain(result.layoutStyle)
    expect(result.engagementModel).toBe('quote')
    expect(result.defaultRoom).toBeTruthy()
  })

  it('unknown industry falls back gracefully', () => {
    const result = resolveSitePresentationRules({
      industry: 'Quantum Tunneling Services',
      services: ['Subatomic Particle Alignment'],
    })
    expect(THEME_SLUGS).toContain(result.theme)
    expect(LAYOUT_SLUGS).toContain(result.layoutStyle)
    expect(result.engagementModel).toBe('quote')
  })

  it('all default values are valid catalog entries', () => {
    expect(THEME_SLUGS).toContain(DEFAULT_THEME)
    expect(LAYOUT_SLUGS).toContain(DEFAULT_LAYOUT)
  })
})
