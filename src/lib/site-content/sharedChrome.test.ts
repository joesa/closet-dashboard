import { describe, expect, it } from 'vitest'
import { propagateSharedChrome } from './sharedChrome'
import type { CustomSiteConfig } from '@/lib/customSite'

/** Header shaped like the real Alvarado markup: brand + nav + quote button. */
function header(brand: string, current: string, quoteHref: string) {
  const link = (href: string, label: string) =>
    `<a href="${href}"${href === current ? ' aria-current="page"' : ''}>${label}</a>`
  return (
    `<header class="site-header"><div class="shell header-main">` +
    `<a class="brand cs-brand" href="/">${brand}</a>` +
    `<nav class="nav">${link('/', 'Home')}${link('/about', 'About Us')}${link('/services', 'Services')}</nav>` +
    `<div class="header-actions"><a class="button" href="${quoteHref}">Quote calculator</a></div>` +
    `</div></header>`
  )
}

const TEXT_BRAND = "Alvarado's Tile Installations"
const LOGO_BRAND = '<img src="/logo.png" alt="Alvarado\'s Tile Installations">'

function footer(email: string) {
  // Mirrors the real footer, which links to /services several times.
  return (
    `<footer class="site-footer"><div class="shell">` +
    `<div class="footer-links"><a href="/services">Cleaning</a><a href="/services">Sealing</a>` +
    `<a href="/services">Restoration</a></div>` +
    `<a href="mailto:${email}">${email}</a></div></footer>`
  )
}

function page(brand: string, current: string, quoteHref: string, email: string, body: string) {
  return `${header(brand, current, quoteHref)}<main>${body}</main>${footer(email)}`
}

function config(pages: Record<string, string>): CustomSiteConfig {
  return {
    mode: 'inline',
    pages: Object.fromEntries(Object.entries(pages).map(([path, html]) => [path, { html }])),
  } as CustomSiteConfig
}

const OLD_EMAIL = 'old@example.com'
const NEW_EMAIL = 'joesa@hutdot.com'

function site(brand: string, email: string): Record<string, string> {
  return {
    '/': page(brand, '/', '#quote', email, '<h1>Home</h1><section id="quote">Quote</section>'),
    '/about': page(brand, '/about', '/#quote', email, '<h1>About</h1>'),
    '/services': page(brand, '/services', '/#quote', email, '<h1>Services</h1>'),
  }
}

describe('propagateSharedChrome', () => {
  it('pushes a logo swapped on the home page out to every other page', () => {
    const previous = config(site(TEXT_BRAND, OLD_EMAIL))
    const edited = { ...site(TEXT_BRAND, OLD_EMAIL) }
    edited['/'] = page(LOGO_BRAND, '/', '#quote', OLD_EMAIL, '<h1>Home</h1><section id="quote">Quote</section>')

    const { config: result, propagations } = propagateSharedChrome(previous, config(edited))

    expect(propagations).toEqual([{ tag: 'header', from: '/', pages: ['/about', '/services'] }])
    for (const path of ['/about', '/services']) {
      expect(result.pages[path].html, path).toContain('<img src="/logo.png"')
      expect(result.pages[path].html, path).not.toContain(TEXT_BRAND.slice(0, 12) + '</a>')
    }
  })

  it('pushes a footer email change out to every other page', () => {
    const previous = config(site(TEXT_BRAND, OLD_EMAIL))
    const edited = { ...site(TEXT_BRAND, OLD_EMAIL) }
    edited['/about'] = page(TEXT_BRAND, '/about', '/#quote', NEW_EMAIL, '<h1>About</h1>')

    const { config: result, propagations } = propagateSharedChrome(previous, config(edited))

    expect(propagations).toEqual([{ tag: 'footer', from: '/about', pages: ['/', '/services'] }])
    for (const path of ['/', '/services']) {
      expect(result.pages[path].html, path).toContain(NEW_EMAIL)
      expect(result.pages[path].html, path).not.toContain(OLD_EMAIL)
    }
  })

  it('re-derives aria-current per page instead of copying the source page\'s', () => {
    const previous = config(site(TEXT_BRAND, OLD_EMAIL))
    const edited = { ...site(TEXT_BRAND, OLD_EMAIL) }
    edited['/'] = page(LOGO_BRAND, '/', '#quote', OLD_EMAIL, '<h1>Home</h1><section id="quote">Quote</section>')

    const { config: result } = propagateSharedChrome(previous, config(edited))

    expect(result.pages['/about'].html).toContain('<a href="/about" aria-current="page">')
    expect(result.pages['/about'].html).not.toContain('<a href="/" aria-current="page">')
    expect(result.pages['/services'].html).toContain('<a href="/services" aria-current="page">')
  })

  it('marks only the nav link as current, never repeated footer links to that page', () => {
    const previous = config(site(TEXT_BRAND, OLD_EMAIL))
    const edited = { ...site(TEXT_BRAND, OLD_EMAIL) }
    edited['/'] = page(LOGO_BRAND, '/', '#quote', NEW_EMAIL, '<h1>Home</h1><section id="quote">Q</section>')

    const { config: result } = propagateSharedChrome(previous, config(edited))

    // /services' footer links to /services three times; only the nav link counts.
    const services = result.pages['/services'].html
    expect((services.match(/aria-current="page"/g) || []).length).toBe(1)
    expect(services).toContain('<a href="/services" aria-current="page">Services</a>')
    expect(services).toContain('<a href="/services">Cleaning</a>')
  })

  it("keeps fragment links pointing at the page that actually has the section", () => {
    const previous = config(site(TEXT_BRAND, OLD_EMAIL))
    const edited = { ...site(TEXT_BRAND, OLD_EMAIL) }
    // Edited on home, where the quote link is a bare #quote.
    edited['/'] = page(LOGO_BRAND, '/', '#quote', OLD_EMAIL, '<h1>Home</h1><section id="quote">Quote</section>')

    const { config: result } = propagateSharedChrome(previous, config(edited))

    // Other pages have no #quote section, so the link must route via home.
    expect(result.pages['/about'].html).toContain('href="/#quote"')
    expect(result.pages['/services'].html).toContain('href="/#quote"')
    // Home keeps the local form.
    expect(result.pages['/'].html).toContain('href="#quote"')
  })

  it('strips editor ids from the copied markup so they cannot collide', () => {
    const previous = config(site(TEXT_BRAND, OLD_EMAIL))
    const edited = { ...site(TEXT_BRAND, OLD_EMAIL) }
    edited['/'] = page(LOGO_BRAND, '/', '#quote', OLD_EMAIL, '<h1>Home</h1><section id="quote">Q</section>')
      .replace('<header class="site-header">', '<header class="site-header" data-content-id="content-1">')

    const { config: result } = propagateSharedChrome(previous, config(edited))
    expect(result.pages['/about'].html).not.toContain('data-content-id')
  })

  it('leaves body-only edits alone', () => {
    const previous = config(site(TEXT_BRAND, OLD_EMAIL))
    const edited = { ...site(TEXT_BRAND, OLD_EMAIL) }
    edited['/about'] = page(TEXT_BRAND, '/about', '/#quote', OLD_EMAIL, '<h1>About us, rewritten</h1>')

    const { config: result, propagations } = propagateSharedChrome(previous, config(edited))
    expect(propagations).toEqual([])
    expect(result.pages['/'].html).toBe(previous.pages['/'].html)
  })

  it('does not amplify a bulk change such as a revision restore', () => {
    const previous = config(site(TEXT_BRAND, OLD_EMAIL))
    const { propagations } = propagateSharedChrome(previous, config(site(LOGO_BRAND, NEW_EMAIL)))
    expect(propagations).toEqual([])
  })

  it('skips pages that have no such chrome rather than injecting one', () => {
    const withBare = (): Record<string, string> => ({
      ...site(TEXT_BRAND, OLD_EMAIL),
      '/bare': '<main><h1>Bare</h1></main>',
    })
    const previous = config(withBare())
    const edited = withBare()
    edited['/'] = page(LOGO_BRAND, '/', '#quote', OLD_EMAIL, '<h1>Home</h1><section id="quote">Q</section>')

    const { config: result, propagations } = propagateSharedChrome(previous, config(edited))
    expect(propagations[0].pages).not.toContain('/bare')
    expect(result.pages['/bare'].html).toBe('<main><h1>Bare</h1></main>')
  })
})
