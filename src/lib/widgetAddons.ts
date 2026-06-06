import { ROOM_TYPES } from '@/lib/rooms'

export type WidgetAddonRow = {
  id: string
  roomType: string
  name: string
  price: number
}

/**
 * Expand room_type "all" add-ons into one entry per enabled room so legacy
 * widget bundles (CDN) that match add-ons by room label still show them.
 * Keeps the real addon id so /api/calculate can resolve pricing.
 */
export function expandAddonsForWidget(
  addons: Array<{ id: string; room_type: string | null; name: string; price: number }>,
  disabledDefaultRooms: string[],
  customRoomNames: string[]
): WidgetAddonRow[] {
  const disabled = new Set(disabledDefaultRooms)
  const enabledRooms = [
    ...ROOM_TYPES.filter((room) => !disabled.has(room)),
    ...customRoomNames,
  ]

  const result: WidgetAddonRow[] = []

  for (const addon of addons) {
    const rt = (addon.room_type || 'all').trim()
    if (rt.toLowerCase() === 'all') {
      for (const room of enabledRooms) {
        result.push({
          id: addon.id,
          roomType: room,
          name: addon.name,
          price: Number(addon.price) || 0,
        })
      }
    } else {
      result.push({
        id: addon.id,
        roomType: rt,
        name: addon.name,
        price: Number(addon.price) || 0,
      })
    }
  }

  return result
}
