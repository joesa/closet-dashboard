import { describe, expect, it } from 'vitest'
import {
  injectGalleryImagesIntoPages,
  parsePageCopy,
  splitParagraphs,
  contentToBlocks,
  buildBasicPagesConfig,
  normalizeAiPagesConfig,
} from '@/lib/catalog/sitePages'

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

describe('parsePageCopy', () => {
  it('unwraps JSON-wrapped copy stored as a raw string', () => {
    const raw = '{ "content": "Line one.\\n\\nLine two." }'
    expect(parsePageCopy(raw)).toBe('Line one.\n\nLine two.')
  })

  it('recovers content from truncated / not-quite-valid JSON', () => {
    const raw = '{ "content": "Middle Tennessee is defined by its landscape.'
    expect(parsePageCopy(raw)).toBe('Middle Tennessee is defined by its landscape.')
  })

  it('passes plain text through untouched', () => {
    expect(parsePageCopy('Just some copy.')).toBe('Just some copy.')
  })

  it('returns empty string for non-strings', () => {
    expect(parsePageCopy(null)).toBe('')
    expect(parsePageCopy(undefined)).toBe('')
  })
})

describe('splitParagraphs', () => {
  it('splits on any run of newlines', () => {
    expect(splitParagraphs('a\n\nb\nc')).toEqual(['a', 'b', 'c'])
  })
})

describe('contentToBlocks', () => {
  it('breaks a copy blob into an intro text block + alternating image sections', () => {
    const copy = 'Intro paragraph.\n\nSecond.\n\nThird.'
    const blocks = contentToBlocks(copy, 'About Us', ['a.jpg', 'b.jpg'])
    expect(blocks[0]).toMatchObject({ type: 'text', heading: 'About Us', body: 'Intro paragraph.' })
    expect(blocks[1].type).toBe('image_left')
    expect(blocks[1].image).toBe('a.jpg')
    expect(blocks[1].heading).toBe('')
    expect(blocks[2].type).toBe('image_right')
    // Never dumps everything into one block.
    expect(blocks.length).toBeGreaterThan(1)
  })

  it('unwraps JSON copy before splitting', () => {
    const blocks = contentToBlocks('{ "content": "One.\\n\\nTwo." }', 'Services')
    expect(blocks[0].body).toBe('One.')
    expect(blocks.some((b) => b.body.includes('{'))).toBe(false)
  })

  it('emits image section types even without images so provisioning can fill them', () => {
    const blocks = contentToBlocks('Intro.\n\nMore.', 'About')
    expect(blocks[1].type).toBe('image_left')
    expect(blocks[1].image).toBeUndefined()
  })
})

describe('buildBasicPagesConfig with copy', () => {
  it('produces structured blocks with images instead of one text dump', () => {
    const pages = buildBasicPagesConfig(
      ['about'],
      { about: 'Intro.\n\nBody one.\n\nBody two.' },
      ['x.jpg']
    )
    const about = pages[0]
    expect(about.content_blocks.length).toBeGreaterThan(1)
    expect(about.content_blocks[0].type).toBe('text')
    expect(about.content_blocks[1].type).toBe('image_left')
    expect(about.content_blocks[1].image).toBe('x.jpg')
  })
})

describe('normalizeAiPagesConfig', () => {
  it('prefers the model structured blocks over the flat page copy', () => {
    const pages = normalizeAiPagesConfig(
      [
        {
          slug: 'about',
          title: 'About Us',
          content_blocks: [{ type: 'grid', heading: 'Team', body: '', items: [] }],
        },
      ],
      ['about'],
      'ai_premium',
      { about: 'Flat copy that should be ignored.' }
    )
    expect(pages[0].content_blocks[0].type).toBe('grid')
  })

  it('splits flat page copy into structured blocks when the model omitted the page', () => {
    const pages = normalizeAiPagesConfig(
      [],
      ['about'],
      'ai_premium',
      { about: 'Intro.\n\nSecond.\n\nThird.' }
    )
    expect(pages[0].content_blocks.length).toBeGreaterThan(1)
    expect(pages[0].content_blocks[0]).toMatchObject({ type: 'text', body: 'Intro.' })
  })
})
