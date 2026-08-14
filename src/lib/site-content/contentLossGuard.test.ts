import { describe, expect, it } from 'vitest'
import { detectCustomContentLoss } from './contentLossGuard'
import type { CustomSiteConfig } from '@/lib/customSite'

const HERO =
  '<section class="hero"><div class="hero-copy"><h1>Cleaner Tile.<br>Clearer Grout Lines.</h1>' +
  '<p>Measured chemistry, timed dwell, agitation, and controlled hot-water extraction for tile and grout across Middle Tennessee.</p></div>' +
  '<div class="hero-side"><img class="hero-image" src="/hero.jpg" alt="Cleaned tile"><p class="place-line">Serving Clarksville and Nashville.</p></div></section>'

const BODY = Array.from({ length: 6 }, (_, i) =>
  `<section class="service-band s${i}"><div class="service-inner"><div class="service-copy">` +
  `<h2>Service ${i}</h2><p>We inspect the surface before quoting, then agree the scope in writing. ` +
  `Grout lines are cleaned with measured chemistry and controlled extraction across the whole field.</p>` +
  `<a href="/services">Explore service ${i}</a></div><img src="/s${i}.jpg" alt="Service ${i}"></div></section>`
).join('')

const HOME = `<header class="site-header"><nav><a href="/">Home</a><a href="/about">About</a></nav></header><main>${HERO}${BODY}</main><footer><p>Alvarado's</p></footer>`

function config(html: string, extraPages: Record<string, string> = {}): CustomSiteConfig {
  return {
    mode: 'inline',
    pages: {
      '/': { html, title: 'Home' },
      ...Object.fromEntries(Object.entries(extraPages).map(([path, value]) => [path, { html: value }])),
    },
  } as CustomSiteConfig
}

describe('detectCustomContentLoss', () => {
  it('flags deleting the hero section that carries the only h1 — the 2026-08-13 incident', () => {
    const reasons = detectCustomContentLoss(config(HOME), config(HOME.replace(HERO, '')))
    expect(reasons.map((reason) => reason.code)).toContain('lost_h1')
    expect(reasons[0].page).toBe('/')
    expect(reasons[0].message).toMatch(/main heading/i)
  })

  it('flags removing the <main> landmark', () => {
    const stripped = HOME.replace('<main>', '<div>').replace('</main>', '</div>')
    const reasons = detectCustomContentLoss(config(HOME), config(stripped))
    expect(reasons.map((reason) => reason.code)).toContain('lost_main')
  })

  it('flags gutting most of the page even when an h1 survives', () => {
    const gutted = `<header></header><main>${HERO}</main>`
    const reasons = detectCustomContentLoss(config(HOME), config(gutted))
    expect(reasons.map((reason) => reason.code)).toContain('content_shrank')
  })

  it('flags deleting a whole sub-page', () => {
    const previous = config(HOME, { '/about': '<main><h1>About</h1><p>Founded in 2009.</p></main>' })
    const reasons = detectCustomContentLoss(previous, config(HOME))
    expect(reasons).toHaveLength(1)
    expect(reasons[0]).toMatchObject({ code: 'page_removed', page: '/about' })
  })

  // The noise tests: a guard that fires on ordinary edits gets clicked through
  // and stops protecting anything.
  it('stays silent when editing heading text', () => {
    const edited = HOME.replace('Cleaner Tile.<br>Clearer Grout Lines.', 'Spotless Tile. Even Grout.')
    expect(detectCustomContentLoss(config(HOME), config(edited))).toEqual([])
  })

  it('stays silent when deleting a single paragraph', () => {
    const edited = HOME.replace(/<p>We inspect the surface before quoting[\s\S]*?<\/p>/, '')
    expect(detectCustomContentLoss(config(HOME), config(edited))).toEqual([])
  })

  it('stays silent when swapping an image source', () => {
    const edited = HOME.replace('/hero.jpg', '/new-hero.jpg')
    expect(detectCustomContentLoss(config(HOME), config(edited))).toEqual([])
  })

  it('stays silent when deleting one whole service section', () => {
    const oneSection = BODY.match(/<section class="service-band s0">[\s\S]*?<\/section>/)![0]
    expect(detectCustomContentLoss(config(HOME), config(HOME.replace(oneSection, '')))).toEqual([])
  })

  it('stays silent when adding content', () => {
    const edited = HOME.replace('</main>', '<section><h2>New</h2><p>Extra copy.</p></section></main>')
    expect(detectCustomContentLoss(config(HOME), config(edited))).toEqual([])
  })

  it('does not flag a page that already had no h1 before the edit', () => {
    const noH1 = HOME.replace(/<h1>[\s\S]*?<\/h1>/, '')
    const edited = noH1.replace('Serving Clarksville and Nashville.', 'Serving Middle Tennessee.')
    expect(detectCustomContentLoss(config(noH1), config(edited))).toEqual([])
  })

  it('ignores newly added pages and missing configs', () => {
    expect(detectCustomContentLoss(config(HOME), config(HOME, { '/new': '<main><h1>New</h1></main>' }))).toEqual([])
    expect(detectCustomContentLoss(null, config(HOME))).toEqual([])
    expect(detectCustomContentLoss(config(HOME), null)).toEqual([])
  })
})
