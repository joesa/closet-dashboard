import {
  buildWidgetConfig,
  parseAddOnText,
  type GeneratedWidgetConfig,
  type WidgetConfigHints,
} from '@/lib/ai/buildWidgetConfig'
import {
  cloneDefaultRoomPricing,
  isRoomType,
  ROOM_TYPES,
  DEFAULT_DOMAIN_CONFIG,
  type RoomPricing,
  type DomainConfig,
  type PricingModel,
} from '@/lib/rooms'
import { resolveIndustrySlug, INDUSTRY_CONFIGS } from '@/lib/catalog/serviceCatalog'
import { getEngineProfile } from '@/lib/catalog/engineProfiles'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

function defaultTierNames(hints: WidgetConfigHints) {
  return {
    basic: hints.tierNames?.basic?.trim() || 'Basic',
    standard: hints.tierNames?.standard?.trim() || 'Standard',
    premium: hints.tierNames?.premium?.trim() || 'Premium',
  }
}

/** Map the intake-wizard pricing model onto the quoting engine's model. */
function resolvePricingModel(hints: WidgetConfigHints): PricingModel {
  switch (hints.pricingModel) {
    case 'fixed':
    case 'flat_tiered':
      return 'flat_tiered'
    case 'base_plus_distance':
      return 'base_plus_distance'
    case 'per_unit':
    case 'linear_ft':
    default:
      return 'per_unit'
  }
}

/** Build the widget domain_config from the contractor's intake hints. */
function buildDomainConfigFromHints(hints: WidgetConfigHints): DomainConfig {
  const industrySlug = resolveIndustrySlug({
    industry: hints.industry,
    services: hints.services,
    other_services: hints.otherServices,
  })

  const industryConfig = INDUSTRY_CONFIGS[industrySlug]

  return {
    ...DEFAULT_DOMAIN_CONFIG,
    categoryLabel: industryConfig?.categoryLabel || DEFAULT_DOMAIN_CONFIG.categoryLabel,
    unitLabel: industryConfig?.unitLabel || DEFAULT_DOMAIN_CONFIG.unitLabel,
    unitAbbrev: industryConfig?.unitAbbrev || DEFAULT_DOMAIN_CONFIG.unitAbbrev,
    tierLabel: industryConfig?.tierLabel || DEFAULT_DOMAIN_CONFIG.tierLabel,
    pricingModel: industryConfig?.pricingModel || resolvePricingModel(hints),
    unitMin: industryConfig?.unitMin || DEFAULT_DOMAIN_CONFIG.unitMin,
    unitMax: industryConfig?.unitMax || DEFAULT_DOMAIN_CONFIG.unitMax,
    baseFee: industryConfig?.baseFee || DEFAULT_DOMAIN_CONFIG.baseFee,
  }
}


function getDefaultPricing(hints: WidgetConfigHints) {
  const slug = resolveIndustrySlug({
    industry: hints.industry,
    services: hints.services,
    other_services: hints.otherServices,
  })
  const profile = getEngineProfile(slug)
  const defaultTier = profile?.serviceDefaults?.[0]?.tiers
  return {
    basic: defaultTier?.[0]?.priceHint ?? 45,
    standard: defaultTier?.[1]?.priceHint ?? 65,
    premium: defaultTier?.[2]?.priceHint ?? 110,
  }
}

/** Seed room_pricing for default rooms the contractor selected in intake. */
export function buildRoomPricingFromHints(hints: WidgetConfigHints): RoomPricing {
  const pricing = cloneDefaultRoomPricing()
  const seed = hints.seedPricing
  const defaults = getDefaultPricing(hints)

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
function mergeGeneratedConfig(
  hints: WidgetConfigHints,
  generated: GeneratedWidgetConfig
): GeneratedWidgetConfig {
  const offered = new Set(hints.services ?? [])
  const disabledDefaultRooms = ROOM_TYPES.filter((room) => !offered.has(room))

  const customRooms = [...(generated.customRooms ?? [])]
  const other = hints.otherServices?.trim()
  if (other && !customRooms.some((r) => r.name.toLowerCase() === other.toLowerCase())) {
    const seed = hints.seedPricing
    const defaults = getDefaultPricing(hints)
    customRooms.push({
      name: other,
      basic: hints.pricingModel === 'fixed' ? (seed?.basic ?? 0) : (seed?.basic ?? defaults.basic),
      standard: seed?.standard ?? defaults.standard,
      premium: seed?.premium ?? defaults.premium,
    })
  }

  const customAddOns =
    generated.customAddOns?.length
      ? generated.customAddOns
      : parseAddOnText(hints.addOnText)

  const customFinishes =
    hints.hasFinishes && hints.finishLabels?.length
      ? hints.finishLabels.map((f, i) => {
          const tierMap = ['basic', 'standard', 'premium'] as const
          return {
            label: f.label,
            description: `${f.label} finish option`,
            swatchHex: f.swatchHex || '#A78B6A',
            tier: tierMap[i % 3],
          }
        })
      : (generated.customFinishes ?? [])

  const disableDefaultFinishes =
    customFinishes.length > 0 || generated.disableDefaultFinishes

  return {
    ...generated,
    customRooms,
    customAddOns,
    customFinishes,
    disabledDefaultRooms,
    disableDefaultFinishes,
  }
}

export async function applyProWidgetConfig(
  contractorId: string,
  hints: WidgetConfigHints
): Promise<void> {
  const admin = getSupabaseAdmin()
  const generated = mergeGeneratedConfig(hints, await buildWidgetConfig(hints))
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
    domain_config: buildDomainConfigFromHints(hints),
    industry: hints.industry?.trim() || undefined,
  }

  try {
    const { pickWidgetThemeForSite } = await import('@/lib/widgetThemes')
    const industryBlob = [
      hints.industry,
      hints.businessName,
      ...(hints.services || []),
      hints.otherServices,
    ]
      .filter(Boolean)
      .join(' ')
    const dark =
      /theater|theatre|cinema|audio.?visual|\bav\b|home theater|media room|nightlife|bar\b/i.test(
        industryBlob
      )
    const theme = pickWidgetThemeForSite({
      mode: dark ? 'dark' : 'light',
      brandColor: hints.brandColor || null,
      industryHint: industryBlob,
    })
    patch.widget_theme_id = theme.id
    if (!hints.brandColor?.trim()) patch.primary_color_hex = theme.brand
  } catch (themeErr) {
    console.warn('[applyProWidgetConfig] widget theme auto-pick failed:', themeErr)
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
