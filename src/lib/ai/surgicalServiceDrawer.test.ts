import { describe, expect, it } from 'vitest'
import {
  looksLikeServiceDrawerRequest,
  wireServiceCardDrawers,
  ensureServiceDrawerCss,
} from './surgicalServiceDrawer'

describe('service card drawers', () => {
  it('detects drawer prompts', () => {
    expect(
      looksLikeServiceDrawerRequest(
        'When we click a service card, open the side drawer with the service details'
      )
    ).toBe(true)
    expect(looksLikeServiceDrawerRequest('make the service cards clickable')).toBe(
      false
    )
  })

  it('converts ?service= plate links into CSS-only drawers', () => {
    const html = `<div class="services-grid"><a href="?service=Collision+Repair" class="plate"><span class="stamp">SPEC 104</span><img src="https://example.com/a.jpg" alt="x"><h3>Collision Repair</h3><p>Structural repair.</p></a><a href="?service=Auto+Painting" class="plate"><img src="https://example.com/b.jpg" alt="y"><h3>Auto Painting</h3><p>Color match.</p></a></div>`
    const { html: out, count } = wireServiceCardDrawers(html)
    expect(count).toBe(2)
    expect(out).toContain('svc-drawer-wrap')
    expect(out).toContain('drawer-toggle')
    expect(out).toContain('side-drawer')
    expect(out).toContain('for="svc-drawer-')
    expect(out).not.toContain('href="?service=')
    expect(out).toContain('Get a quote')
  })

  it('appends drawer CSS when missing wrap support', () => {
    const css = ensureServiceDrawerCss('body{color:#111}')
    expect(css).toContain('.svc-drawer-wrap')
    expect(css).toContain('.drawer-toggle:checked')
  })
})
