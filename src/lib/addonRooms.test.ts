import { describe, expect, it } from 'vitest'
import {
  addonScopeKey,
  formatAddonScopeLabel,
  getAddonTargetRooms,
  roomScopeToDbFields,
} from './addonRooms'

describe('addonRooms', () => {
  it('treats legacy room_type all as all rooms', () => {
    expect(getAddonTargetRooms({ room_type: 'all' })).toEqual([])
    expect(addonScopeKey({ room_type: 'all' })).toBe('all')
  })

  it('reads explicit room_types arrays', () => {
    expect(
      getAddonTargetRooms({
        room_type: 'all',
        room_types: ['Walk-In Closet', 'Garage'],
      })
    ).toEqual(['Walk-In Closet', 'Garage'])
  })

  it('formats scope labels', () => {
    expect(formatAddonScopeLabel([])).toBe('All rooms')
    expect(formatAddonScopeLabel(['Garage'])).toBe('Garage')
    expect(formatAddonScopeLabel(['Garage', 'Walk-In Closet'])).toBe(
      'Garage, Walk-In Closet'
    )
  })

  it('maps scope selections to db fields', () => {
    expect(roomScopeToDbFields([], true)).toEqual({
      room_type: 'all',
      room_types: null,
    })
    expect(roomScopeToDbFields(['Garage'], false)).toEqual({
      room_type: 'Garage',
      room_types: ['Garage'],
    })
    expect(roomScopeToDbFields(['Garage', 'Walk-In Closet'], false)).toEqual({
      room_type: 'all',
      room_types: ['Garage', 'Walk-In Closet'],
    })
  })
})
