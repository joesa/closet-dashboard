import { describe, expect, it } from 'vitest'
import { injectGalleryImagesIntoPages } from '@/lib/catalog/sitePages'

describe('injectGalleryImagesIntoPages', () => {
  it('adds a gallery block and hero image on the portfolio page', () => {
    const pages = injectGalleryImagesIntoPages(
      [
        {
          slug: '/about',
          title: 'About Us',
          hero: { headline: 'About', subheadline: '' },
          content_blocks: [{ type: 'text', heading: 'About', body: 'Story' }],
        },
        {
          slug: '/portfolio',
          title: 'Portfolio / Gallery',
          hero: { headline: 'Gallery', subheadline: '' },
          content_blocks: [
            { type: 'text', heading: 'Showcasing', body: 'Copy without photos' },
          ],
        },
      ],
      ['https://example.com/a.jpg', 'https://example.com/b.jpg']
    )

    const portfolio = pages.find((p) => p.slug === '/portfolio')
    expect(portfolio?.hero).toMatchObject({ backgroundImage: 'https://example.com/a.jpg' })
    expect(portfolio?.content_blocks[0]).toMatchObject({
      type: 'gallery',
      images: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
    })
  })

  it('leaves non-portfolio pages unchanged', () => {
    const input = [
      {
        slug: '/about',
        title: 'About',
        hero: { headline: 'About', subheadline: '' },
        content_blocks: [],
      },
    ]
    expect(injectGalleryImagesIntoPages(input, ['https://example.com/x.jpg'])).toEqual(input)
  })
})
