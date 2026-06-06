import { describe, expect, it } from 'vitest'
import { expandAddonsForWidget } from './widgetAddons'

describe('expandAddonsForWidget', () => {
  it('duplicates all-room add-ons for each enabled room', () => {
    const result = expandAddonsForWidget(
      [{ id: 'a1', room_type: 'all', name: 'Speakers', price: 150 }],
      ['Pantry & Wine', 'Home Office'],
      ['Basement Theaters']
    )

    expect(result).toHaveLength(13) // 14 defaults - 2 disabled + 1 custom
    expect(result.filter((a) => a.name === 'Speakers')).toHaveLength(13)
    expect(result.find((a) => a.roomType === 'Walk-In Closet')?.id).toBe('a1')
    expect(result.find((a) => a.roomType === 'Basement Theaters')?.id).toBe('a1')
    expect(result.some((a) => a.roomType === 'Pantry & Wine')).toBe(false)
  })

  it('keeps room-specific add-ons as-is', () => {
    const result = expandAddonsForWidget(
      [{ id: 'b1', room_type: 'Garage', name: 'Shelf', price: 50 }],
      [],
      []
    )
    expect(result).toEqual([
      { id: 'b1', roomType: 'Garage', name: 'Shelf', price: 50 },
    ])
  })

  it('expands multi-room room_types to matching widget rooms only', () => {
    const result = expandAddonsForWidget(
      [
        {
          id: 'c1',
          room_type: 'all',
          room_types: ['Walk-In Closet', 'Basement Theaters'],
          name: 'Speakers',
          price: 150,
        },
      ],
      ['Pantry & Wine'],
      ['Basement Theaters']
    )
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.roomType).sort()).toEqual([
      'Basement Theaters',
      'Walk-In Closet',
    ])
  })
})
