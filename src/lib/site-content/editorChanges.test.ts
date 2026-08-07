import { describe, expect, it } from 'vitest'
import { coupledEngineChanges, imagePresentationChange, restoreDocumentChanges } from './editorChanges'
import type { SiteContentDocument } from './types'

function document(): SiteContentDocument {
  return {
    brand_name: 'Acme',
    hero_config: {},
    about_config: {},
    process_config: { steps: [] },
    products_config: [],
    seo_config: {},
    before_after_config: null,
    quiz_config: null,
    nav_links: [{ label: 'Home', slug: '/' }],
    pages_config: [],
    logo_url: null,
    pricing_notes: null,
    content_structure: {},
  }
}

describe('editor page/navigation coupling', () => {
  it('adds a new active page to navigation in the same save', () => {
    const changes = coupledEngineChanges(document(), {
      op: 'insert',
      path: '/pages_config',
      index: 0,
      value: { slug: '/blog', title: 'Blog', is_active: true },
    })

    expect(changes).toHaveLength(2)
    expect(changes[1]).toEqual({
      op: 'insert', path: '/nav_links', index: 1, value: { label: 'Blog', slug: '/blog' },
    })
  })

  it('does not duplicate an existing navigation target', () => {
    const source = document()
    source.nav_links.push({ label: 'Blog', slug: '/blog' })
    const changes = coupledEngineChanges(source, {
      op: 'insert',
      path: '/pages_config',
      index: 0,
      value: { slug: '/blog', title: 'Blog', is_active: true },
    })

    expect(changes).toHaveLength(1)
  })

  it('keeps page renames connected to their navigation item', () => {
    const source = document()
    source.pages_config = [{ slug: '/about', title: 'About Us', is_active: true }]
    source.nav_links.push({ label: 'About Us', slug: '/about' })

    expect(coupledEngineChanges(source, {
      op: 'set', path: '/pages_config/0/title', value: 'Our History',
    })).toContainEqual({
      op: 'set', path: '/nav_links/1/label', value: 'Our History',
    })
  })
})

describe('image presentation changes', () => {
  it('preserves existing image dimensions while updating the selected path', () => {
    const source = document()
    source.content_structure.imagePresentation = {
      '/logo_url': { widthPercent: 20, aspectRatio: 1 },
    }
    expect(imagePresentationChange(source, '/pages_config/0/content_blocks/0/images/1', {
      widthPercent: 62.5,
      aspectRatio: 1.333,
    })).toEqual({
      op: 'set',
      path: '/content_structure/imagePresentation',
      value: {
        '/logo_url': { widthPercent: 20, aspectRatio: 1 },
        '/pages_config/0/content_blocks/0/images/1': { widthPercent: 62.5, aspectRatio: 1.333 },
      },
    })
  })
})

describe('undo and redo snapshots', () => {
  it('never sends custom-site content through an engine-site restore', () => {
    const source = document()
    source.custom_config = { pages: { '/': { html: '<main />' } } }
    const changes = restoreDocumentChanges(source, 'engine')
    expect(changes.some((change) => change.path === '/custom_config')).toBe(false)
    expect(changes).toContainEqual({ op: 'set', path: '/hero_config', value: {} })
  })

  it('limits custom-site restores to fields accepted by the custom API', () => {
    const source = document()
    source.custom_config = { pages: { '/': { html: '<main />' } } }
    expect(restoreDocumentChanges(source, 'custom').map((change) => change.path)).toEqual([
      '/brand_name', '/seo_config', '/logo_url', '/custom_config/pages',
    ])
  })
})
