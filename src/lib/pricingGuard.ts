/**
 * Hard gate: offered quote services must not ship with all-zero tier prices.
 * A room is unpriced only when basic + standard + premium === 0 (allows
 * legitimate basic=0 for flat_tiered / fixed pricing).
 */

export type PricedRoomLike = {
  name?: string | null
  basic?: number | null
  standard?: number | null
  premium?: number | null
  price_basic?: number | null
  price_standard?: number | null
  price_premium?: number | null
}

export function roomIsUnpriced(room: PricedRoomLike): boolean {
  const basic = Number(room.basic ?? room.price_basic) || 0
  const standard = Number(room.standard ?? room.price_standard) || 0
  const premium = Number(room.premium ?? room.price_premium) || 0
  return basic + standard + premium === 0
}

export function findUnpricedRooms(rooms: PricedRoomLike[]): PricedRoomLike[] {
  return rooms.filter(roomIsUnpriced)
}

export class UnpricedServicesError extends Error {
  readonly unpricedNames: string[]

  constructor(unpricedNames: string[]) {
    const list = unpricedNames.length ? unpricedNames.join(', ') : '(unnamed)'
    super(`Cannot save offered services with all-zero pricing: ${list}`)
    this.name = 'UnpricedServicesError'
    this.unpricedNames = unpricedNames
  }
}

/**
 * Throws if any room still has all-zero tiers after soft backfill.
 * Call immediately before DB inserts / PATCH persistence.
 */
export function assertOfferedServicesPriced(rooms: PricedRoomLike[]): void {
  const unpriced = findUnpricedRooms(rooms)
  if (unpriced.length === 0) return
  const names = unpriced.map((r) => (r.name || '').trim() || '(unnamed)')
  throw new UnpricedServicesError(names)
}
