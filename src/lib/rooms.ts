// Shared room + pricing-tier constants used by the dashboard, settings API,
// and calculate API. Keep this list in sync with the JSONB default on
// contractor_settings.room_pricing (see supabase/schema.sql).

export const ROOM_TYPES = [
  'Walk-In Closet',
  'Reach-In Closet',
  'Garage',
  'Pantry & Wine',
  'Home Office',
  'Laundry Room',
  'Mudroom',
  'Entertainment Center',
  'Wall Beds',
  'Craft Room',
  'Home Library',
  'Kid Spaces',
  'Dressing Room',
  'Home Storage',
] as const

export type RoomType = (typeof ROOM_TYPES)[number]

export const PRICING_TIERS = ['basic', 'standard', 'premium'] as const
export type PricingTier = (typeof PRICING_TIERS)[number]

export type RoomPricing = Record<RoomType, Record<PricingTier, number>>

export const DEFAULT_ROOM_PRICING: RoomPricing = {
  'Walk-In Closet': { basic: 45, standard: 65, premium: 120 },
  'Reach-In Closet': { basic: 35, standard: 55, premium: 95 },
  Garage: { basic: 60, standard: 85, premium: 150 },
  'Pantry & Wine': { basic: 25, standard: 40, premium: 75 },
  'Home Office': { basic: 50, standard: 75, premium: 130 },
  'Laundry Room': { basic: 30, standard: 50, premium: 85 },
  Mudroom: { basic: 40, standard: 60, premium: 100 },
  'Entertainment Center': { basic: 65, standard: 95, premium: 160 },
  'Wall Beds': { basic: 80, standard: 110, premium: 180 },
  'Craft Room': { basic: 35, standard: 55, premium: 90 },
  'Home Library': { basic: 70, standard: 100, premium: 170 },
  'Kid Spaces': { basic: 30, standard: 45, premium: 80 },
  'Dressing Room': { basic: 55, standard: 85, premium: 140 },
  'Home Storage': { basic: 35, standard: 55, premium: 95 },
}

export function isRoomType(value: unknown): value is RoomType {
  return typeof value === 'string' && (ROOM_TYPES as readonly string[]).includes(value)
}

export function isPricingTier(value: unknown): value is PricingTier {
  return typeof value === 'string' && (PRICING_TIERS as readonly string[]).includes(value)
}

// Returns a deep copy so callers can safely mutate it in component state.
export function cloneDefaultRoomPricing(): RoomPricing {
  const out = {} as RoomPricing
  for (const room of ROOM_TYPES) {
    out[room] = { ...DEFAULT_ROOM_PRICING[room] }
  }
  return out
}

// Normalize a value from the DB to ensure all rooms/tiers are present.
// Falls back to defaults for any missing key so the UI/API never NaN.
export function normalizeRoomPricing(value: unknown): RoomPricing {
  const base = cloneDefaultRoomPricing()
  if (!value || typeof value !== 'object') return base
  const input = value as Record<string, Partial<Record<PricingTier, unknown>>>
  for (const room of ROOM_TYPES) {
    const roomVal = input[room]
    if (!roomVal || typeof roomVal !== 'object') continue
    for (const tier of PRICING_TIERS) {
      const n = Number(roomVal[tier])
      if (Number.isFinite(n)) base[room][tier] = n
    }
  }
  return base
}

// A custom room defined by an individual contractor (lives in the
// contractor_rooms table, not the room_pricing JSONB on contractor_settings).
export type CustomRoom = {
  id: string
  name: string
  price_basic: number
  price_standard: number
  price_premium: number
}

// A custom finish/material color defined by a contractor. Pricing is driven
// by `tier` (mapped to the room_pricing matrix); `swatch_hex` is the color
// shown in the widget's finish picker.
export type CustomFinish = {
  id: string
  label: string
  description: string | null
  swatch_hex: string
  tier: PricingTier
  sort_order: number
}

// The three system-default finish ids (matches widget hardcoded list).
export const DEFAULT_FINISH_IDS = ['basic', 'standard', 'premium'] as const
export type DefaultFinishId = (typeof DEFAULT_FINISH_IDS)[number]

// Build a lookup of `roomName -> { basic, standard, premium }` that merges
// the contractor's per-tier defaults with any custom rooms they've added.
// Custom rooms override defaults if a contractor names one identically.
export function mergeRoomPricing(
  defaults: RoomPricing,
  customs: CustomRoom[] | null | undefined
): Record<string, Record<PricingTier, number>> {
  const merged: Record<string, Record<PricingTier, number>> = { ...defaults }
  for (const r of customs ?? []) {
    merged[r.name] = {
      basic: Number(r.price_basic) || 0,
      standard: Number(r.price_standard) || 0,
      premium: Number(r.price_premium) || 0,
    }
  }
  return merged
}
