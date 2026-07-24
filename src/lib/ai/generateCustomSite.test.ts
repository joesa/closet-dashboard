import { describe, expect, it } from 'vitest'
import { extractCssAccent, mergeCustomPatch } from './generateCustomSite'
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
  it('prompts allow brief-added services and forbid silent drops', async () => {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const src = readFileSync(join(__dirname, 'generateCustomSite.ts'), 'utf8')
    expect(src).toContain('You MAY add services the creative brief explicitly introduces')
    expect(src).toContain('serviceUpdates')
    expect(src).not.toContain('Do not invent extra services; do not drop any.')
  })
})
