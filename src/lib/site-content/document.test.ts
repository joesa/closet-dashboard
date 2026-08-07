import { describe, expect, it } from 'vitest'
import { applyContentChanges } from './document'
import type { SiteContentDocument } from './types'

function engineDocument(): SiteContentDocument {
  return {
    brand_name: 'Acme Services',
    hero_config: { headline: 'Welcome', subheadline: 'Original' },
    about_config: { description: 'About us' },
    process_config: { title: 'How it works', steps: [] },
    products_config: [{ title: 'One', image: '', description: '' }],
    seo_config: {},
    before_after_config: null,
    quiz_config: null,
    nav_links: [{ label: 'Home', slug: '/' }],
    pages_config: [],
    logo_url: null,
    pricing_notes: null,
    content_structure: {
      homeSections: ['hero', 'about', 'products', 'process', 'engagement'],
      hiddenHomeSections: [],
    },
  }
}

describe('site content document operations', () => {
  it('applies structured set, insert, and move operations without mutating the source', () => {
    const source = engineDocument()
    const next = applyContentChanges(source, [
      { op: 'set', path: '/hero_config/headline', value: 'Updated' },
      { op: 'insert', path: '/products_config', index: 1, value: { title: 'Two', image: '', description: '' } },
      { op: 'move', path: '/content_structure/homeSections', from: 3, to: 1 },
    ], 'engine')

    expect(next.hero_config.headline).toBe('Updated')
    expect((next.products_config[1] as { title: string }).title).toBe('Two')
    expect(next.content_structure.homeSections).toEqual(['hero', 'process', 'about', 'products', 'engagement'])
    expect(source.hero_config.headline).toBe('Welcome')
  })

  it('rejects hiding or removing protected homepage functionality', () => {
    const source = engineDocument()
    expect(() => applyContentChanges(source, [
      { op: 'insert', path: '/content_structure/hiddenHomeSections', index: 0, value: 'engagement' },
    ], 'engine')).toThrow(/cannot be hidden/i)
    expect(() => applyContentChanges(source, [
      { op: 'remove', path: '/content_structure/homeSections/0' },
    ], 'engine')).toThrow(/hero section cannot be removed/i)
  })

  it('rejects navigation links to missing pages', () => {
    expect(() => applyContentChanges(engineDocument(), [
      { op: 'insert', path: '/nav_links', index: 1, value: { label: 'Missing', slug: '/missing' } },
    ], 'engine')).toThrow(/navigation target does not exist/i)
  })

  it('keeps a page rename and its navigation label in sync', () => {
    const source = engineDocument()
    source.pages_config = [{
      slug: '/about',
      title: 'About Us',
      is_active: true,
      hero: { headline: 'About Us' },
      content_blocks: [],
    }]
    source.nav_links = [
      { label: 'Home', slug: '/' },
      { label: 'About Us', slug: '/about' },
    ]

    const next = applyContentChanges(source, [
      { op: 'set', path: '/pages_config/0/title', value: 'Our History' },
    ], 'engine')

    expect((next.pages_config[0] as { title: string }).title).toBe('Our History')
    expect(next.nav_links).toContainEqual({ label: 'Our History', slug: '/about' })
  })

  it('updates or removes navigation when a page slug, visibility, or page changes', () => {
    const source = engineDocument()
    source.pages_config = [{
      slug: '/about', title: 'About Us', is_active: true,
      hero: { headline: 'About Us' }, content_blocks: [],
    }]
    source.nav_links = [{ label: 'About Us', slug: '/about' }]

    const renamed = applyContentChanges(source, [
      { op: 'set', path: '/pages_config/0/slug', value: '/history' },
    ], 'engine')
    expect(renamed.nav_links).toEqual([{ label: 'About Us', slug: '/history' }])

    const hidden = applyContentChanges(source, [
      { op: 'set', path: '/pages_config/0/is_active', value: false },
    ], 'engine')
    expect(hidden.nav_links).toEqual([])

    const removed = applyContentChanges(source, [
      { op: 'remove', path: '/pages_config/0' },
    ], 'engine')
    expect(removed.nav_links).toEqual([])
  })

  it('accepts supported image presentation settings and rejects unknown values', () => {
    const source = engineDocument()
    source.pages_config = [{
      slug: '/gallery', title: 'Gallery', is_active: true, hero: { headline: 'Gallery' },
      content_blocks: [{ type: 'gallery', heading: 'Work', body: '', images: ['https://example.com/a.jpg'] }],
    }]
    const next = applyContentChanges(source, [
      { op: 'set', path: '/pages_config/0/content_blocks/0/imageSize', value: 'small' },
      { op: 'set', path: '/pages_config/0/content_blocks/0/imageAspect', value: 'square' },
      { op: 'set', path: '/pages_config/0/content_blocks/0/imageFit', value: 'contain' },
    ], 'engine')
    expect(next.pages_config).toMatchObject([{ content_blocks: [{ imageSize: 'small', imageAspect: 'square', imageFit: 'contain' }] }])
    expect(() => applyContentChanges(source, [
      { op: 'set', path: '/pages_config/0/content_blocks/0/imageSize', value: 'gigantic' },
    ], 'engine')).toThrow(/invalid image size/i)

    const hero = applyContentChanges(source, [
      { op: 'set', path: '/hero_config/imageFit', value: 'contain' },
      { op: 'set', path: '/hero_config/imagePosition', value: 'top' },
      { op: 'set', path: '/hero_config/imageScale', value: '110' },
    ], 'engine')
    expect(hero.hero_config).toMatchObject({ imageFit: 'contain', imagePosition: 'top', imageScale: '110' })
    expect(() => applyContentChanges(source, [
      { op: 'set', path: '/hero_config/imageScale', value: '500' },
    ], 'engine')).toThrow(/invalid hero image zoom/i)

    const resized = applyContentChanges(source, [{
      op: 'set',
      path: '/content_structure/imagePresentation',
      value: { '/pages_config/0/content_blocks/0/image': { widthPercent: 68.5, aspectRatio: 1.4 } },
    }], 'engine')
    expect(resized.content_structure.imagePresentation).toEqual({
      '/pages_config/0/content_blocks/0/image': { widthPercent: 68.5, aspectRatio: 1.4 },
    })
    expect(() => applyContentChanges(source, [{
      op: 'set', path: '/content_structure/imagePresentation', value: { '/logo_url': { widthPercent: 1000, aspectRatio: 1 } },
    }], 'engine')).toThrow(/invalid image width/i)
  })

  it('sanitizes custom HTML and preserves the required widget placeholder', () => {
    const source = {
      ...engineDocument(),
      custom_config: {
        mode: 'inline' as const,
        pages: {
          '/': { html: '<main><h1>Hello</h1><!-- CLOSET_WIDGET --></main>' },
        },
      },
    }
    const next = applyContentChanges(source, [{
      op: 'set',
      path: '/custom_config/pages/~1/html',
      value: '<main><script>alert(1)</script><h1>Safe</h1><!-- CLOSET_WIDGET --></main>',
    }], 'custom')
    const html = (next.custom_config as { pages: Record<string, { html: string }> }).pages['/'].html
    expect(html).not.toContain('<script>')
    expect(html).toContain('CLOSET_WIDGET')
  })

  it('rejects all core-system roots from website content operations', () => {
    for (const path of [
      '/theme', '/theme_tokens', '/layout_style', '/design_variant',
      '/engagement_model', '/engine_config_draft', '/render_mode',
    ]) {
      expect(() => applyContentChanges(engineDocument(), [
        { op: 'set', path, value: 'malicious override' },
      ], 'engine'), path).toThrow(/not editable/i)
    }
  })

  it('canonicalizes structure and discards attempts to store design controls there', () => {
    const next = applyContentChanges(engineDocument(), [{
      op: 'set',
      path: '/content_structure',
      value: {
        homeSections: ['hero', 'about', 'engagement'],
        hiddenHomeSections: [],
        theme: 'attacker-theme',
        template: 'other-tenant-template',
        engagementModel: 'disabled',
      },
    }], 'engine')
    expect(next.content_structure).toEqual({
      homeSections: ['hero', 'about', 'engagement'],
      hiddenHomeSections: [],
    })
  })

  it('preserves custom-site mode and CSS even when a direct client tries to replace them', () => {
    const source = {
      ...engineDocument(),
      custom_config: {
        mode: 'inline' as const,
        globalCss: '.brand { color: green; }',
        pages: {
          '/': {
            html: '<main><h1>Original</h1><!-- CLOSET_WIDGET --></main>',
            css: '.hero { min-height: 80vh; }',
          },
        },
      },
    }
    expect(() => applyContentChanges(source, [{
      op: 'set', path: '/custom_config/globalCss', value: '* { display: none; }',
    }], 'custom')).toThrow(/design, CSS, mode, and platform controls/i)

    const next = applyContentChanges(source, [{
      op: 'set',
      path: '/custom_config/pages',
      value: {
        '/': {
          html: '<main><h1>Updated</h1><!-- CLOSET_WIDGET --></main>',
          css: '.hero { display: none; }',
        },
        '/new': { html: '<main>New page</main>', css: '* { display: none; }' },
      },
    }], 'custom')
    const custom = next.custom_config as {
      mode: string
      globalCss?: string
      pages: Record<string, { html: string; css?: string }>
    }
    expect(custom.mode).toBe('inline')
    expect(custom.globalCss).toBe('.brand { color: green; }')
    expect(custom.pages['/'].css).toBe('.hero { min-height: 80vh; }')
    expect(custom.pages['/'].html).toContain('Updated')
    expect(custom.pages['/new'].css).toBeUndefined()
  })
})
