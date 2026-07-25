import { describe, expect, it } from 'vitest'
import {
  appendImagesToGallery,
  appendImagesToPagesConfigGallery,
  applyImagesToProducts,
  buildInventedRedesignBriefNote,
  ensureServiceCardImage,
  mergeCustomBuildNotes,
} from './applyBriefServiceImages'

describe('applyBriefServiceImages', () => {
  it('sets product image + provenance details', () => {
    const products = applyImagesToProducts(
      [{ title: 'Vehicle Wrapping', description: 'Wraps' }],
      [
        {
          title: 'Vehicle Wrapping',
          url: 'https://cdn.example/wrap.png',
          note: 'AI-generated for brief add',
        },
      ]
    )
    expect(products[0].image).toBe('https://cdn.example/wrap.png')
    expect((products[0].details as { imageSource?: string }).imageSource).toBe(
      'ai_brief_add'
    )
  })

  it('injects img into data-brief-added ticket', () => {
    const html =
      '<div class="ticket" data-brief-added="1"><h3>Brake Service</h3><p>Pads</p></div>'
    const out = ensureServiceCardImage(
      html,
      'Brake Service',
      'https://cdn.example/brakes.png'
    )
    expect(out).toContain('src="https://cdn.example/brakes.png"')
    expect(out).toContain('data-brief-service-image="1"')
    expect(out).toContain('Brake Service')
  })

  it('appends images into gal-grid', () => {
    const html =
      '<div class="gal-grid"><img src="https://cdn.example/a.jpg" alt="a" /></div>'
    const out = appendImagesToGallery(html, ['https://cdn.example/b.jpg'])
    expect(out).toContain('https://cdn.example/a.jpg')
    expect(out).toContain('https://cdn.example/b.jpg')
    expect(out).toContain('data-brief-gallery="1"')
  })

  it('merges into pages_config gallery block', () => {
    const pages = appendImagesToPagesConfigGallery(
      [
        {
          slug: '/portfolio',
          content_blocks: [
            { type: 'gallery', heading: 'Our Work', images: ['https://cdn.example/old.jpg'] },
          ],
        },
      ],
      ['https://cdn.example/new.jpg']
    ) as Array<{ content_blocks: Array<{ images?: string[] }> }>
    expect(pages[0].content_blocks[0].images).toEqual([
      'https://cdn.example/old.jpg',
      'https://cdn.example/new.jpg',
    ])
  })

  it('appends custom_build_notes', () => {
    const notes = mergeCustomBuildNotes([], [
      {
        at: '2026-07-25T00:00:00.000Z',
        kind: 'brief_service_image',
        service: 'Wraps',
        imageUrl: 'https://cdn.example/w.png',
        note: 'AI-generated',
      },
    ])
    expect(notes).toHaveLength(1)
    expect(notes[0].kind).toBe('brief_service_image')
    if (notes[0].kind === 'brief_service_image') {
      expect(notes[0].service).toBe('Wraps')
    }
  })

  it('persists invented redesign brief notes', () => {
    const notes = mergeCustomBuildNotes([], [
      buildInventedRedesignBriefNote({
        signatureConcept: 'Bay tickets on cool enamel',
        optimizedBrief: '1. DESIGN DIRECTION — …\n8. PROCESS — …',
        source: 'anthropic',
      }),
    ])
    expect(notes[0].kind).toBe('invented_redesign_brief')
    if (notes[0].kind === 'invented_redesign_brief') {
      expect(notes[0].signatureConcept).toMatch(/Bay tickets/)
      expect(notes[0].note).toMatch(/DESIGN DIRECTION/)
      expect(notes[0].source).toBe('anthropic')
    }
  })
})
