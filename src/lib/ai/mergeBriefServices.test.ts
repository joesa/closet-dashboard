import { describe, expect, it } from 'vitest'
import {
  mergeIntakeServicesWithBriefUpdates,
  parseServiceUpdates,
} from './mergeBriefServices'

describe('parseServiceUpdates', () => {
  it('returns empty arrays for junk input', () => {
    expect(parseServiceUpdates(null)).toEqual({ added: [], removed: [] })
    expect(parseServiceUpdates('x')).toEqual({ added: [], removed: [] })
  })

  it('normalizes added and removed entries', () => {
    expect(
      parseServiceUpdates({
        added: [
          { title: ' Ceramic Coating ', description: ' Long-lasting protection ' },
          { title: '' },
          { title: 1 },
        ],
        removed: [{ title: ' Old Wash ', reason: 'brief says drop it' }],
      })
    ).toEqual({
      added: [{ title: 'Ceramic Coating', description: 'Long-lasting protection' }],
      removed: [{ title: 'Old Wash', reason: 'brief says drop it' }],
    })
  })
})

describe('mergeIntakeServicesWithBriefUpdates', () => {
  const intake = [
    { title: 'Exterior Detail', description: 'Wash + wax', image: 'https://cdn.example/a.jpg' },
    { title: 'Interior Detail', description: 'Vacuum + wipe' },
  ]

  it('keeps all intake when updates are empty', () => {
    const result = mergeIntakeServicesWithBriefUpdates(intake, { added: [], removed: [] })
    expect(result.products).toHaveLength(2)
    expect(result.added).toEqual([])
    expect(result.removed).toEqual([])
  })

  it('appends brief services without dropping intake', () => {
    const result = mergeIntakeServicesWithBriefUpdates(intake, {
      added: [{ title: 'Ceramic Coating', description: 'Multi-year protection' }],
    })
    expect(result.products.map((p) => p.title)).toEqual([
      'Exterior Detail',
      'Interior Detail',
      'Ceramic Coating',
    ])
    expect(result.products[2].image).toBe('https://cdn.example/a.jpg')
    expect(result.added).toEqual([
      { title: 'Ceramic Coating', description: 'Multi-year protection' },
    ])
  })

  it('does not duplicate case-insensitively', () => {
    const result = mergeIntakeServicesWithBriefUpdates(intake, {
      added: [{ title: 'exterior detail' }],
    })
    expect(result.products).toHaveLength(2)
    expect(result.added).toEqual([])
  })

  it('removes intake titles only when listed in removed', () => {
    const result = mergeIntakeServicesWithBriefUpdates(intake, {
      removed: [{ title: 'Interior Detail', reason: 'brief: drop interior' }],
      added: [{ title: 'Paint Correction' }],
    })
    expect(result.products.map((p) => p.title)).toEqual([
      'Exterior Detail',
      'Paint Correction',
    ])
    expect(result.removed).toEqual([
      { title: 'Interior Detail', reason: 'brief: drop interior' },
    ])
    expect(result.added).toEqual([{ title: 'Paint Correction' }])
  })
})
