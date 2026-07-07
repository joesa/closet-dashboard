import { describe, expect, it } from 'vitest'
import type { IntakeImageSelections } from '@/lib/intake/imageSelections'
import {
  extractProspectSiteConfig,
  mergeProspectImageSelections,
} from '@/lib/intake/mergeProspectImages'

const selections: IntakeImageSelections = {
  hero: {
    attemptsUsed: 1,
    selectedUrl: 'https://cdn.example/hero.jpg',
    history: [],
  },
  products: [
    {
      serviceName: 'Tree Trimming & Pruning',
      productIndex: 0,
      attemptsUsed: 1,
      selectedUrl: 'https://cdn.example/p0.jpg',
      history: [],
    },
    {
      serviceName: 'Emergency Storm Cleanup',
      productIndex: 1,
      attemptsUsed: 1,
      selectedUrl: 'https://cdn.example/p1.jpg',
      history: [],
    },
  ],
}

describe('extractProspectSiteConfig', () => {
  it('returns null when only logo metadata is stored', () => {
    expect(extractProspectSiteConfig({ logoGeneration: { status: 'done' } })).toBeNull()
  })

  it('returns siteConfig when nested brief exists', () => {
    const siteConfig = { theme: 'brutalist', hero: { headline: 'Hi' } }
    expect(extractProspectSiteConfig({ siteConfig })).toEqual(siteConfig)
  })
})

describe('mergeProspectImageSelections', () => {
  it('synthesizes product slots when the brief has no products array', () => {
    const { config, generated } = mergeProspectImageSelections({}, selections)

    expect(config.hero?.image).toBe('https://cdn.example/hero.jpg')
    expect(config.products).toHaveLength(2)
    expect(config.products?.[0]).toMatchObject({
      title: 'Tree Trimming & Pruning',
      image: 'https://cdn.example/p0.jpg',
    })
    expect(generated.hero).toBe('https://cdn.example/hero.jpg')
    expect(generated.products).toHaveLength(2)
    expect(generated.products[0].image).toBe('https://cdn.example/p0.jpg')
  })

  it('maps selections onto existing AI product titles', () => {
    const { config, generated } = mergeProspectImageSelections(
      {
        products: [
          { title: 'Tree Trimming and Pruning', description: 'A' },
          { title: 'Storm Cleanup', description: 'B' },
        ],
      },
      selections
    )

    expect(config.products?.[0]?.image).toBe('https://cdn.example/p0.jpg')
    expect(config.products?.[1]?.image).toBe('https://cdn.example/p1.jpg')
    expect(generated.products).toHaveLength(2)
  })
})
