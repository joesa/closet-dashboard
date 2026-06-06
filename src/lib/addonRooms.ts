/** Addon row shape from contractor_addons (legacy room_type + optional room_types). */
export type AddonRoomSource = {
  room_type: string | null
  room_types?: string[] | null
}

/** Returns true when the add-on applies to every enabled widget room. */
export function addonAppliesToAllRooms(addon: AddonRoomSource): boolean {
  const types = addon.room_types?.filter(Boolean)
  if (types && types.length > 0) {
    return types.length === 1 && types[0].toLowerCase() === 'all'
  }
  return (addon.room_type || 'all').trim().toLowerCase() === 'all'
}

/** Resolved room labels this add-on targets (empty = all enabled rooms). */
export function getAddonTargetRooms(addon: AddonRoomSource): string[] {
  const types = addon.room_types?.map((r) => r.trim()).filter(Boolean)
  if (types && types.length > 0) {
    if (types.length === 1 && types[0].toLowerCase() === 'all') return []
    return types
  }
  const legacy = (addon.room_type || 'all').trim()
  if (legacy.toLowerCase() === 'all') return []
  return [legacy]
}

/** Stable key for grouping add-ons that share the same room scope. */
export function addonScopeKey(addon: AddonRoomSource): string {
  const targets = getAddonTargetRooms(addon)
  if (targets.length === 0) return 'all'
  return [...targets].sort().join('\0')
}

/** Human label for a scope key / target list. */
export function formatAddonScopeLabel(
  targets: string[],
  allRoomsLabel = 'All rooms'
): string {
  if (targets.length === 0) return allRoomsLabel
  if (targets.length === 1) return targets[0]
  if (targets.length === 2) return `${targets[0]}, ${targets[1]}`
  return `${targets[0]} +${targets.length - 1} more`
}

/** DB fields to persist a room scope selection from the dashboard. */
export function roomScopeToDbFields(
  selectedRooms: string[],
  allRoomsSelected: boolean
): { room_type: string; room_types: string[] | null } {
  if (allRoomsSelected || selectedRooms.length === 0) {
    return { room_type: 'all', room_types: null }
  }
  if (selectedRooms.length === 1) {
    return { room_type: selectedRooms[0], room_types: selectedRooms }
  }
  return { room_type: 'all', room_types: selectedRooms }
}
