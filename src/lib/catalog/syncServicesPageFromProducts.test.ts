import { describe, expect, it } from 'vitest'
import { syncServicesPageFromProducts } from './syncServicesPageFromProducts'

describe('syncServicesPageFromProducts', () => {
  it('keeps intro text and strips embedded service listings', () => {
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
          {
            type: 'grid',
            heading: 'What we offer',
            items: [{ title: 'Auto Wrapping', description: 'Long wrap copy…' }],
          },
        ],
      },
      { slug: '/about', title: 'About', content_blocks: [{ type: 'text', body: 'x' }] },
    ]
    const products = [
      { title: 'Collision Repair', description: 'Collision' },
      { title: 'Auto Wrapping', description: 'Wraps' },
    ]

    const out = syncServicesPageFromProducts(pages, products)
    const services = out.find((p) => p.slug === '/services')!
    expect(services.content_blocks).toEqual([
      {
        type: 'text',
        heading: 'Every Kind of Collision Damage, Handled',
        body: 'Intro copy.',
      },
    ])
    expect(out.find((p) => p.slug === '/about')?.content_blocks).toEqual(
      pages[1].content_blocks
    )
  })
})
