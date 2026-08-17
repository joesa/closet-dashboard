import { describe, expect, it } from 'vitest'
import {
  assertSurgicalIntegrity,
  cssHasDesignTokens,
  draftCssLooksBroken,
  ensureClickableCardCss,
  isCatastrophicCssReplace,
  looksLikeClickableCardsRequest,
  makeServiceCardsClickable,
  mergeSurgicalGlobalCss,
} from './surgicalIntegrity'
import { mergeCustomPatch } from './generateCustomSite'
import type { CustomSiteConfig } from '@/lib/customSite'

const designCss = `:root{--bg:#ece9e3;--ink:#1c1c1a;--muted:#6b6862;--acc:#d94f2b;}body{background:var(--bg);color:var(--ink)}.wrap{max-width:1100px}.site-header{display:flex}`

const additiveCss = `.clickable-card{cursor:pointer;display:block}.clickable-card:hover{transform:translateY(-2px)}`

const base: CustomSiteConfig = {
  mode: 'inline',
  globalCss: designCss,
  pages: {
    '/': {
      html: `<header class="site-header"><nav class="nav"><a href="/">Home</a></nav></header><main><div class="service-card"><h3>Paint</h3><a href="/contact">Quote</a></div><div class="service-card"><h3>Wrap</h3></div></main><footer class="site-footer">x</footer>`,
      title: 'Home',
    },
    '/services': {
      html: `<header class="site-header"></header><div class="card product-card"><h3>A</h3></div><footer class="f"></footer>`,
      title: 'Services',
    },
  },
}

describe('surgical CSS integrity', () => {
  it('detects design tokens and catastrophic shrink', () => {
    expect(cssHasDesignTokens(designCss)).toBe(true)
    expect(cssHasDesignTokens(additiveCss)).toBe(false)
    expect(isCatastrophicCssReplace(designCss, additiveCss)).toBe(true)
    expect(isCatastrophicCssReplace(designCss, designCss + additiveCss)).toBe(false)
  })

  it('appends truncated globalCss instead of replacing', () => {
    const result = mergeSurgicalGlobalCss({
      baseCss: designCss,
      globalCss: additiveCss,
    })
    expect(result.replaced).toBe(false)
    expect(result.appended).toBe(true)
    expect(result.globalCss).toContain(':root')
    expect(result.globalCss).toContain('.clickable-card')
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('honors globalCssAppend without touching tokens', () => {
    const result = mergeSurgicalGlobalCss({
      baseCss: designCss,
      globalCssAppend: additiveCss,
    })
    expect(result.appended).toBe(true)
    expect(result.globalCss.startsWith(':root')).toBe(true)
  })

  it('mergeCustomPatch rejects wipe via integrity-aware CSS merge', () => {
    const { merged, warnings } = mergeCustomPatch(base, {
      globalCss: additiveCss,
      pages: {},
    })
    expect(merged.globalCss).toContain(':root')
    expect(merged.globalCss).toContain('.clickable-card')
    expect(warnings.some((w) => /append|Rejected/i.test(w))).toBe(true)
  })

  it('assertSurgicalIntegrity reverts gutted CSS and landmark loss', () => {
    const bad = {
      globalCss: additiveCss,
      pages: {
        '/': { html: '<main><p>no chrome</p></main>' },
      },
    }
    const result = assertSurgicalIntegrity(base, bad)
    expect(result.ok).toBe(false)
    expect(result.repaired.globalCss).toBe(designCss)
    expect(result.repaired.pages?.['/']?.html).toContain('<header')
  })

  it('draftCssLooksBroken compares draft vs published', () => {
    expect(draftCssLooksBroken(additiveCss, designCss)).toBe(true)
    expect(draftCssLooksBroken(designCss + additiveCss, designCss)).toBe(false)
  })

  it('treats absent draft CSS as broken — callers must gate on a draft existing', () => {
    // The helper cannot tell "no draft" from "draft whose CSS was wiped", so
    // this stays true; the custom-build status route is what must check that a
    // draft exists before asking. Documented here so the pairing is not lost.
    expect(draftCssLooksBroken(undefined, designCss)).toBe(true)
    expect(draftCssLooksBroken('', designCss)).toBe(true)
    // With nothing published there is no baseline, so nothing to call broken.
    expect(draftCssLooksBroken(undefined, undefined)).toBe(false)
  })

  it('does not flag a full redesign that swaps one token system for another', () => {
    const oldSystem = ':root{--bg:#e4eae6;--ink:#13232a;--acc:#0f6c85}\n.wrap{max-width:1200px}'
    const newSystem =
      ':root{--bg:#EFF2F0;--face:#FFF;--ink:#14201F;--acc:#0E6FA8;--gut:8px}\n.wrap{width:min(1200px,100%)}\n.tile{background:var(--face)}'
    expect(draftCssLooksBroken(newSystem, oldSystem)).toBe(false)
  })
})

describe('clickable cards shortcut helpers', () => {
  it('detects clickable prompts', () => {
    expect(looksLikeClickableCardsRequest('make the service cards clickable')).toBe(
      true
    )
    expect(looksLikeClickableCardsRequest('fix the typo')).toBe(false)
  })

  it('wraps service cards and ensures CSS', () => {
    const { html, wrapped } = makeServiceCardsClickable(base.pages['/']!.html!)
    expect(wrapped).toBeGreaterThan(0)
    expect(html).toContain('clickable-card')
    expect(html).toContain('href=')
    const css = ensureClickableCardCss(designCss)
    expect(css).toContain('.clickable-card')
    expect(css).toContain(':root')
  })
})
