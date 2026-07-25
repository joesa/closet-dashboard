import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  assessFullRedesignCraft,
  extractCssAccent,
  mergeCustomPatch,
} from './generateCustomSite'
import type { CustomSiteConfig } from '@/lib/customSite'

const base: CustomSiteConfig = {
  mode: 'inline',
  globalCss: 'body{color:#111}',
  pages: {
    '/': { html: '<h1>Old Home</h1>', title: 'Home' },
    '/about': { html: '<h1>About</h1>', title: 'About' },
    '/contact': { html: '<h1>Contact</h1>', title: 'Contact' },
  },
}

describe('mergeCustomPatch', () => {
  it('updates only the pages and fields in the patch', () => {
    const { merged, changedPages } = mergeCustomPatch(base, {
      pages: {
        '/': { html: '<h1>New Home</h1>' },
      },
    })
    expect(changedPages).toEqual(['/'])
    expect(merged.pages['/'].html).toBe('<h1>New Home</h1>')
    expect(merged.pages['/about'].html).toBe('<h1>About</h1>')
    expect(merged.pages['/contact'].html).toBe('<h1>Contact</h1>')
    expect(merged.globalCss).toBe('body{color:#111}')
  })

  it('does not drop pages omitted from the patch', () => {
    const { merged } = mergeCustomPatch(base, { pages: { '/about': { title: 'Our Story' } } })
    expect(Object.keys(merged.pages).sort()).toEqual(['/', '/about', '/contact'])
    expect(merged.pages['/about'].title).toBe('Our Story')
    expect(merged.pages['/about'].html).toBe('<h1>About</h1>')
  })

  it('ignores null globalCss (no overwrite)', () => {
    const { merged } = mergeCustomPatch(base, { globalCss: null, pages: {} })
    expect(merged.globalCss).toBe('body{color:#111}')
  })

  it('applies globalCss when provided as a string', () => {
    const { merged } = mergeCustomPatch(base, { globalCss: ':root{--c:red}' })
    expect(merged.globalCss).toBe(':root{--c:red}')
  })
})

describe('extractCssAccent', () => {
  it('reads --acc from design tokens', () => {
    expect(extractCssAccent(':root{--bg:#f4f1ea;--acc:#c05a1e;--ink:#111}')).toBe(
      '#c05a1e'
    )
  })

  it('reads --accent as a fallback name', () => {
    expect(extractCssAccent('--accent: #a67c2d;')).toBe('#a67c2d')
  })

  it('returns null when no accent token exists', () => {
    expect(extractCssAccent('body{color:#111}')).toBeNull()
  })
})

describe('full redesign additive service policy', () => {
  it('prompts allow brief-added services and forbid silent drops', () => {
    const src = readFileSync(join(__dirname, 'generateCustomSite.ts'), 'utf8')
    expect(src).toContain('You MAY add services the creative brief explicitly introduces')
    expect(src).toContain('serviceUpdates')
    expect(src).not.toContain('Do not invent extra services; do not drop any.')
  })
})

describe('full redesign craft uplift prompt', () => {
  const src = readFileSync(join(__dirname, 'generateCustomSite.ts'), 'utf8')

  it('requires a signature concept from subject-derived direction', () => {
    expect(src).toContain('signature concept')
    expect(src).toContain('subject-derived design')
    expect(src).toContain('Pass 1 — Direction')
  })

  it('includes CSS-only cookbook and bans JS form estimators', () => {
    expect(src).toContain('ALLOWED CSS-only interactivity')
    expect(src).toContain('details/summary')
    expect(src).toContain('FORBIDDEN:')
    expect(src).toContain('multi-step quote/booking wizards')
    expect(src).toContain('Map any brief "quote estimator"')
  })

  it('keeps compact size budgets for serverless time limits', () => {
    expect(src).toContain('globalCss ≤ 9000 chars')
    expect(src).toContain('Home html ≤ 12000 chars')
    expect(src).toContain('Total ≤ 48000 chars')
  })
})

describe('assessFullRedesignCraft', () => {
  it('warns on thin home without tokens or fonts', () => {
    const tips = assessFullRedesignCraft({
      config: {
        mode: 'inline',
        globalCss: 'body{color:#111}',
        pages: { '/': { html: '<header></header><h1>Hi</h1>' } },
      },
      serviceCount: 3,
      brief: 'mobile detailing in clarksville',
    })
    expect(tips.some((t) => /thin/i.test(t))).toBe(true)
    expect(tips.some((t) => /CSS variables|token/i.test(t))).toBe(true)
    expect(tips.some((t) => /Google Fonts/i.test(t))).toBe(true)
    // Multiple services alone must NOT imply dual-lane
    expect(tips.some((t) => /dual-lane|second accent/i.test(t))).toBe(false)
  })

  it('only hints dual-lane when the brief is explicitly dual-discipline', () => {
    const tips = assessFullRedesignCraft({
      config: {
        mode: 'inline',
        globalCss: ':root{--bg:#fff;--acc:#111}',
        pages: {
          '/': {
            html: `<link href="https://fonts.googleapis.com/css2?family=Manrope&display=swap" rel="stylesheet">
<section></section><section></section><section></section><section></section>`,
          },
        },
      },
      serviceCount: 6,
      brief: 'vinyl wraps and mechanical brake repair under one roof',
    })
    expect(tips.some((t) => /two distinct lanes|second accent/i.test(t))).toBe(true)
  })

  it('flags dark+neon AI default when brief did not ask for it', () => {
    const tips = assessFullRedesignCraft({
      config: {
        mode: 'inline',
        globalCss: ':root{--ink:#0b0d0f;--acc:#c8f23c}',
        pages: {
          '/': {
            html: `<link href="https://fonts.googleapis.com/css2?family=Manrope&display=swap" rel="stylesheet">
<section></section><section></section><section></section><section></section>`,
          },
        },
      },
      brief: 'friendly family plumbing',
    })
    expect(tips.some((t) => /dark \+ neon|AI default/i.test(t))).toBe(true)
  })

  it('flags cream+terracotta AI default when brief did not ask for it', () => {
    const tips = assessFullRedesignCraft({
      config: {
        mode: 'inline',
        globalCss: ':root{--paper:#f4f1ea;--acc:#c05a1e}',
        pages: {
          '/': {
            html: `<link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville&display=swap" rel="stylesheet">
<section></section><section></section><section></section><section></section>`,
          },
        },
      },
      brief: 'mobile detailing in clarksville',
    })
    expect(tips.some((t) => /cream paper \+ terracotta/i.test(t))).toBe(true)
  })

  it('stays quiet for a token-rich multi-section home', () => {
    const tips = assessFullRedesignCraft({
      config: {
        mode: 'inline',
        globalCss: ':root{--bg:#f7f4ef;--surface:#fff;--acc:#1a5f4a}',
        pages: {
          '/': {
            html: `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope&display=swap">
<section></section><section></section><section></section><section></section>
<a class="btn">Get a quote</a>`,
          },
        },
      },
      serviceCount: 4,
      brief: 'warm coastal cleaning',
    })
    expect(tips).toEqual([])
  })
})

describe('full redesign anti-AI bias', () => {
  it('prompt bans AI default clusters and requires subject-derived design', () => {
    const src = readFileSync(join(__dirname, 'generateCustomSite.ts'), 'utf8')
    expect(src).toContain('subject-derived design')
    expect(src).toContain('Banned defaults')
    expect(src).toContain('Cream/off-white + high-contrast serif')
    expect(src).toContain('NEVER default to dark charcoal + neon')
    expect(src).toContain('ENGAGEMENT ENGINE')
    expect(src).toContain('WIDGET_PLACEHOLDER')
    expect(src).not.toContain('cyan = how it looks / gold = how it runs')
    expect(src).not.toContain('carbon-ish overlay')
    expect(src).not.toContain('Builder prompt')
    expect(src).not.toContain('Next.js + Tailwind')
  })
})

describe('full redesign brief enhancement', () => {
  it('wires enhanceFullRedesignBrief before site generation', () => {
    const src = readFileSync(join(__dirname, 'generateCustomSite.ts'), 'utf8')
    expect(src).toContain('enhanceFullRedesignBrief')
    expect(src).toContain('OPTIMIZED CREATIVE BRIEF')
    expect(src).toContain('ADMIN SEED')
    expect(src).toContain('DIRECTION LOCK')
  })
})
