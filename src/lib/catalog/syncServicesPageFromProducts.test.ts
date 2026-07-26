import { describe, expect, it } from 'vitest'
import { syncServicesPageFromProducts } from './syncServicesPageFromProducts'

describe('syncServicesPageFromProducts', () => {
  it('expands a truncated /services page to cover all products', () => {
    const pages = [
      {
        slug: '/services',
        title: 'Services',
        content_blocks: [
          {
            type: 'text',
            heading: 'Every Kind of Collision Damage, Handled',
            body: 'Intro copy.',
          },
          { type: 'image_left', heading: 'Collision Repair', body: 'A' },
          { type: 'image_right', heading: 'Bumper Repair', body: 'B' },
        ],
      },
      { slug: '/about', title: 'About', content_blocks: [{ type: 'text', body: 'x' }] },
    ]
    const products = [
      { title: 'Collision Repair', description: 'Collision' },
      { title: 'Auto Painting', description: 'Paint' },
      { title: 'Auto Wrapping', description: 'Wraps' },
      { title: 'Glass & Windshield', description: 'Glass' },
      { title: 'Frame & Structural Repair', description: 'Frame' },
    ]

    const out = syncServicesPageFromProducts(pages, products)
    const services = out.find((p) => p.slug === '/services')!
    expect(services.content_blocks?.[0]).toMatchObject({
      type: 'text',
      heading: 'Every Kind of Collision Damage, Handled',
    })
    const grid = services.content_blocks?.find((b) => b.type === 'grid')
    expect(grid?.items?.map((i) => i.title)).toEqual([
      'Collision Repair',
      'Auto Painting',
      'Auto Wrapping',
      'Glass & Windshield',
      'Frame & Structural Repair',
    ])
    expect(out.find((p) => p.slug === '/about')?.content_blocks).toEqual(
      pages[1].content_blocks
    )
  })
})
