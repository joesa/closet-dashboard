import { describe, expect, it } from 'vitest'
import { coupledEngineChanges } from './editorChanges'
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
