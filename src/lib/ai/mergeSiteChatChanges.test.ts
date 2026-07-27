import { describe, expect, it } from 'vitest'
import {
  adminAskedToRemove,
  mergeProductsConfig,
  mergeSiteChatColumn,
} from './mergeSiteChatChanges'

describe('mergeProductsConfig', () => {
  const current = [
    { title: 'Collision Repair', description: 'A', image: 'a.jpg' },
    { title: 'Auto Wrapping', description: 'Wrap', image: 'w.jpg' },
    { title: 'Glass & Windshield', description: 'G', image: 'g.jpg' },
  ]

  it('preserves truncated AI lists instead of dropping services', () => {
    const incoming = [
      { title: 'Collision Repair', description: 'Updated collision' },
      { title: 'Auto Painting', description: 'Paint' },
    ]
    const out = mergeProductsConfig(current, incoming, { allowShrink: false }) as Array<{
      title: string
      description: string
      image?: string
    }>
    expect(out.map((p) => p.title)).toEqual([
      'Collision Repair',
      'Auto Wrapping',
      'Glass & Windshield',
      'Auto Painting',
    ])
    expect(out[0].description).toBe('Updated collision')
    expect(out[0].image).toBe('a.jpg')
    expect(out[1].image).toBe('w.jpg')
  })

  it('allows shrink when admin asked to remove', () => {
    const incoming = [{ title: 'Collision Repair', description: 'Only this' }]
    const out = mergeProductsConfig(current, incoming, { allowShrink: true }) as Array<{
      title: string
    }>
    expect(out).toHaveLength(1)
    expect(out[0].title).toBe('Collision Repair')
  })
})

describe('mergeSiteChatColumn', () => {
  it('deep-merges hero_config', () => {
    const out = mergeSiteChatColumn(
      'hero_config',
      { headline: 'Old', subheadline: 'Keep me', backgroundImage: 'x.jpg' },
      { headline: 'New headline' },
      'Shorten the hero'
    ) as { headline: string; subheadline: string; backgroundImage: string }
    expect(out).toEqual({
      headline: 'New headline',
      subheadline: 'Keep me',
      backgroundImage: 'x.jpg',
    })
  })
})

describe('adminAskedToRemove', () => {
  it('detects remove intent', () => {
    expect(adminAskedToRemove('Remove Auto Wrapping from services')).toBe(true)
    expect(adminAskedToRemove('Shorten the hero headline')).toBe(false)
  })
})
