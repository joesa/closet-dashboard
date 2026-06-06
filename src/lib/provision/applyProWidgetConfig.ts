import {
  buildWidgetConfig,
  type GeneratedWidgetConfig,
  type WidgetConfigHints,
} from '@/lib/ai/buildWidgetConfig'
import {
  cloneDefaultRoomPricing,
  isRoomType,
  type RoomPricing,
} from '@/lib/rooms'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

function defaultTierNames(hints: WidgetConfigHints) {
  return {
    basic: hints.tierNames?.basic?.trim() || 'Basic',
    standard: hints.tierNames?.standard?.trim() || 'Standard',
    premium: hints.tierNames?.premium?.trim() || 'Premium',
  }
}

/** Seed room_pricing for default rooms the contractor selected in intake. */
export function buildRoomPricingFromHints(hints: WidgetConfigHints): RoomPricing {
  const pricing = cloneDefaultRoomPricing()
  const seed = hints.seedPricing
  const defaults = { basic: 45, standard: 65, premium: 110 }

  for (const service of hints.services ?? []) {
    if (!isRoomType(service)) continue
    if (hints.pricingModel === 'fixed') {
      pricing[service] = {
        basic: seed?.basic ?? 0,
        standard: seed?.standard ?? defaults.standard,
        premium: seed?.premium ?? defaults.premium,
      }
    } else {
      pricing[service] = {
        basic: seed?.basic ?? defaults.basic,
        standard: seed?.standard ?? defaults.standard,
        premium: seed?.premium ?? defaults.premium,
      }
    }
  }

  return pricing
}

/**
 * Apply Pro intake wizard answers to an existing contractor_settings row.
 * Used when the contractor already has a trial row from signup — avoids
 * spinning up a duplicate tenant via the async provision cron.
 */
export async function applyProWidgetConfig(
  contractorId: string,
  hints: WidgetConfigHints
): Promise<void> {
  const admin = getSupabaseAdmin()
  const generated = await buildWidgetConfig(hints)
  const tierNames = defaultTierNames(hints)
  const roomPricing = buildRoomPricingFromHints(hints)

  await admin.from('contractor_addons').delete().eq('contractor_id', contractorId)
  await admin.from('contractor_finishes').delete().eq('contractor_id', contractorId)
  await admin.from('contractor_rooms').delete().eq('contractor_id', contractorId)

  await insertGeneratedCatalog(admin, contractorId, generated)

  const disabledFinishes = generated.disableDefaultFinishes
    ? ['basic', 'standard', 'premium']
    : []

  const patch: Record<string, unknown> = {
    company_name: hints.businessName?.trim() || undefined,
    primary_color_hex: hints.brandColor?.trim() || undefined,
    room_pricing: roomPricing,
    disabled_default_rooms: generated.disabledDefaultRooms,
    disabled_default_finishes: disabledFinishes,
    tier_names: tierNames,
  }

  const { error } = await admin
    .from('contractor_settings')
    .update(patch)
    .eq('id', contractorId)

  if (error) throw error
}

async function insertGeneratedCatalog(
  admin: ReturnType<typeof getSupabaseAdmin>,
  contractorId: string,
  generated: GeneratedWidgetConfig
) {
  if (generated.customRooms?.length) {
    const { error } = await admin.from('contractor_rooms').insert(
      generated.customRooms.map((r) => ({
        contractor_id: contractorId,
        name: r.name,
        price_basic: r.basic || 0,
        price_standard: r.standard || 0,
        price_premium: r.premium || 0,
      }))
    )
    if (error) throw error
  }

  if (generated.customAddOns?.length) {
    const { error } = await admin.from('contractor_addons').insert(
      generated.customAddOns.map((a) => ({
        contractor_id: contractorId,
        name: a.name,
        room_type: a.roomType || 'all',
        price: a.price || 0,
      }))
    )
    if (error) throw error
  }

  if (generated.customFinishes?.length) {
    const { error } = await admin.from('contractor_finishes').insert(
      generated.customFinishes.map((f, i) => ({
        contractor_id: contractorId,
        label: f.label,
        description: f.description,
        swatch_hex: f.swatchHex || '#cccccc',
        tier: f.tier || 'basic',
        sort_order: i,
      }))
    )
    if (error) throw error
  }
}
