import { describe, expect, it } from 'vitest'
import {
  ensureImageLightboxCss,
  lightboxPriorityPaths,
  looksLikeImageLightboxRequest,
  normalizeBrandLogoLinks,
  wireImageLightboxes,
} from './surgicalImageLightbox'

describe('image lightbox surgical', () => {
  it('detects lightbox / enlarge prompts', () => {
    expect(
      looksLikeImageLightboxRequest(
        'When images are clicked on they should enlarge. Use lightbox for this.'
      )
    ).toBe(true)
    expect(
      looksLikeImageLightboxRequest('Make portfolio photos open in a lightbox')
    ).toBe(true)
    expect(looksLikeImageLightboxRequest('Make the service cards clickable')).toBe(
      false
    )
  })

  it('wraps bare portfolio images and skips already-wired + drawer faces', () => {
    const html = `<div class="panel"><div class="plate"><img src="https://cdn.example/a.jpg" alt="A"><p>WO-1</p></div><div class="plate"><label class="img-lightbox"><input type="checkbox" class="lightbox-toggle"><img src="https://cdn.example/b.jpg" alt="B"></label></div><div class="svc-drawer-wrap"><img src="https://cdn.example/c.jpg" alt="C"></div><header><img src="https://cdn.example/logo.png" alt="Logo"></header></div>`
    const { html: out, count } = wireImageLightboxes(html)
    expect(count).toBe(1)
    expect(out).toContain('img-lightbox')
    expect(out.match(/img-lightbox/g)?.length).toBeGreaterThanOrEqual(2)
    expect(out).toContain('svc-drawer-wrap')
    expect(out).toContain('alt="Logo"')
    expect(out).not.toMatch(
      /header[\s\S]*img-lightbox[\s\S]*logo/i
    )
    // Bare header logo becomes a home link, not a lightbox.
    expect(out).toMatch(/<a[^>]*href="\/"[^>]*>[\s\S]*logo\.png/i)
  })

  it('unwraps wrongly lightboxed brand logos and links them home', () => {
    const html =
      `<header><label class="img-lightbox"><input type="checkbox" class="lightbox-toggle"><img src="https://cdn.example/brand.png" alt="Acme Logo"></label></header>`
    const { html: out, fixed } = normalizeBrandLogoLinks(html)
    expect(fixed).toBeGreaterThan(0)
    expect(out).not.toContain('img-lightbox')
    expect(out).toMatch(/href="\/"/)
    expect(out).toContain('brand.png')
  })

  it('repoints a brand logo whose href was set to an asset URL', () => {
    // Verbatim shape of the Alvarado header: "Apply to selection" on the
    // selected brand link wrote a media-proxy URL into href, so clicking the
    // logo downloaded a JPEG. The old check only caught empty/#/javascript:.
    const proxy = '/api/a/2ZHZfz747te3HkVNFiPLAUGp38rCpwwLntEFnj7QOxvm'
    const html =
      `<header class="site-header"><div class="shell header-main">` +
      `<a class="brand" href="${proxy}"><img src="${proxy}" alt="Alvarado's Tile Installations"></a>` +
      `<nav class="nav"><a href="/about">About Us</a></nav></div></header>`
    const { html: out, fixed } = normalizeBrandLogoLinks(html)

    expect(fixed).toBeGreaterThan(0)
    expect(out).toMatch(/<a class="brand[^"]*" href="\/"/)
    // Only the link is repaired — the image itself still points at the asset.
    expect(out).toContain(`src="${proxy}"`)
    // Unrelated navigation is untouched.
    expect(out).toContain('href="/about"')
  })

  it('leaves a brand logo that already links somewhere real alone', () => {
    const html =
      `<header><a class="cs-brand" href="/home"><img src="/logo.png" alt="Logo"></a></header>`
    const { html: out } = normalizeBrandLogoLinks(html)
    expect(out).toContain('href="/home"')
  })

  it('is idempotent', () => {
    const html =
      '<div class="plate"><img src="https://cdn.example/a.jpg" alt="A"></div>'
    const once = wireImageLightboxes(html)
    const twice = wireImageLightboxes(once.html)
    expect(once.count).toBe(1)
    expect(twice.count).toBe(0)
  })

  it('prioritizes /portfolio paths', () => {
    expect(
      lightboxPriorityPaths('enlarge images', ['/', '/about', '/portfolio'])
    ).toEqual(['/portfolio', '/', '/about'])
  })

  it('appends lightbox CSS and strips duplicate partial rules', () => {
    const prior = `body{color:#111}
.img-lightbox { display: block; cursor: zoom-in; }
.lightbox-toggle { display: none; }
`
    const css = ensureImageLightboxCss(prior)
    expect(css).toContain('surgical: image lightbox')
    expect(css).toContain('.lightbox-toggle:checked + img')
    expect(css).toContain('object-fit:contain')
  })
})
