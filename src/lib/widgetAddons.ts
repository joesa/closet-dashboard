import { getAddonTargetRooms } from '@/lib/addonRooms'
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
  addons: Array<{
    id: string
    room_type: string | null
    room_types?: string[] | null
    name: string
    price: number
  }>,
  disabledDefaultRooms: string[],
  customRoomNames: string[]
): WidgetAddonRow[] {
  const disabled = new Set(disabledDefaultRooms)
  const enabledRooms = [
    ...ROOM_TYPES.filter((room) => !disabled.has(room)),
    ...customRoomNames,
  ]
  const enabledSet = new Set(enabledRooms)

  const result: WidgetAddonRow[] = []

  for (const addon of addons) {
    const targets = getAddonTargetRooms(addon)
    const rooms =
      targets.length === 0
        ? enabledRooms
        : targets.filter((room) => enabledSet.has(room))

    for (const room of rooms) {
      result.push({
        id: addon.id,
        roomType: room,
        name: addon.name,
        price: Number(addon.price) || 0,
      })
    }
  }

  return result
}
