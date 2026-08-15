import { generateTextForPurpose } from '@/lib/ai/aiTextProvider'
import { resolveIndustrySlug } from '@/lib/catalog/serviceCatalog'
import { getEngineProfile } from '@/lib/catalog/engineProfiles'
import { formatServiceSeedPricing, resolveServiceTiers } from '@/lib/catalog/servicePriceCatalog'
import { getServiceUxDefaults } from '@/lib/catalog/serviceUxDefaults'
import { LUCIDE_ICON_ALLOWLIST, sanitizeLucideIcon } from '@/lib/catalog/lucideIconAllowlist'
import { roomIsUnpriced } from '@/lib/pricingGuard'
import type { MarketBound } from '@/lib/marketBounds'

/**
 * Widget configuration hints gathered during the DitchTheForm Pro intake
 * wizard. These drive the AI-generated calculator config so each contractor
 * gets a setup that matches their actual business — not a one-size-fits-all
 * default.
 */
export type WidgetConfigHints = {
  /** Industry / trade the contractor is in (e.g. "Plumbing", "Towing",
   *  "Landscaping"). Defaults conceptually to custom storage / closets. */
  industry?: string
  /** Space types the contractor works in (empty = no room-based pricing) */
  services: string[]
  /** Whether they offer other services that don't map to rooms */
  otherServices?: string
  /**
   * Pricing model:
   * - 'linear_ft' / 'per_unit'        – rate per measured unit (closet ft, pressure-wash ft², etc.)
   * - 'fixed' / 'flat_tiered'         – flat price per job/tier (plumbing fixtures, tow hookup)
   * - 'base_plus_distance'            – base/hookup fee + rate per distance (towing)
   */
  pricingModel: 'linear_ft' | 'fixed' | 'per_unit' | 'flat_tiered' | 'base_plus_distance'
  /** Custom names for the three pricing tiers (default: Basic/Standard/Premium) */
  tierNames?: { basic?: string; standard?: string; premium?: string }
  /** Seed pricing per tier — optional starting points the AI can refine */
  seedPricing?: { basic?: number; standard?: number; premium?: number }
  /** Whether the contractor carries different material finishes */
  hasFinishes: boolean
  /** Up to 3 custom finish labels with optional hex swatch colors */
  finishLabels?: Array<{ label: string; swatchHex?: string }>
  /** Free-text add-ons they offer (comma-separated) */
  addOnText?: string
  /** Extra explanation of how the contractor thinks about quoting jobs. */
  calculatorNotes?: string
  /** Brand color hex */
  brandColor?: string
  /** Business name for context */
  businessName?: string
  /** Optional metro for Firecrawl market bounds research */
  metro?: string
  /** Pre-fetched market bounds (injected by callers) */
  marketBounds?: MarketBound[]
}

export type GeneratedWidgetConfig = {
  customRooms: Array<{
    name: string
    basic: number
    standard: number
    premium: number
    icon?: string
    requiresPackage?: boolean
    requiresMaterials?: boolean
  }>
  customAddOns: Array<{
    name: string
    roomType?: string
    price: number
  }>
  customFinishes: Array<{
    label: string
    description?: string
    swatchHex: string
    tier: 'basic' | 'standard' | 'premium'
  }>
  /** Which default rooms to disable (ones the contractor doesn't offer) */
  disabledDefaultRooms: string[]
  /** Whether to disable all default finish tiers (replace with custom ones) */
  disableDefaultFinishes: boolean
  /** Trade-specific package labels */
  tierNames?: { basic: string; standard: string; premium: string }
  /** Distinct hex swatches for package cards */
  tierColors?: { basic: string; standard: string; premium: string }
}

export function parseAddOnText(addOnText?: string) {
  return (addOnText || '')
    .split(/[,;\n]+/)
    .map((a) => a.trim())
    .filter(Boolean)
    .map((name) => ({ name, roomType: 'all', price: 150 }))
}

const DEFAULT_ROOMS = [
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
]

const CLOSET_TIER_DEFAULTS = new Set(['basic', 'standard', 'premium', 'melamine', 'wood', 'paint'])

function formatMarketBounds(bounds?: MarketBound[]): string {
  if (!bounds?.length) return ''
  return bounds
    .filter((b) => b.samples >= 2)
    .map(
      (b) =>
        `- ${b.serviceKey}: keep basic≥$${b.low}, premium≤$${b.high} (${b.samples} samples, ${b.metro})`
    )
    .join('\n')
}

function normalizeGenerated(
  parsed: GeneratedWidgetConfig,
  hints: WidgetConfigHints
): GeneratedWidgetConfig {
  const slug = resolveIndustrySlug({
    industry: hints.industry,
    services: hints.services,
    other_services: hints.otherServices,
  })
  const isClosets = slug === 'custom-closets'

  const rooms = (parsed.customRooms || []).map((r) => {
    const ux = getServiceUxDefaults(r.name, slug)
    const catalog = resolveServiceTiers(r.name, slug)
    const priced = roomIsUnpriced(r)
      ? catalog
      : {
          basic: Number(r.basic) || catalog.basic,
          standard: Number(r.standard) || catalog.standard,
          premium: Number(r.premium) || catalog.premium,
        }
    return {
      name: r.name,
      ...priced,
      icon: sanitizeLucideIcon(r.icon, ux.icon),
      requiresPackage:
        typeof r.requiresPackage === 'boolean' ? r.requiresPackage : ux.requiresPackage,
      requiresMaterials:
        typeof r.requiresMaterials === 'boolean' ? r.requiresMaterials : ux.requiresMaterials,
    }
  })

  // Diversify icons if AI assigned the same one to every service.
  if (rooms.length > 1) {
    const icons = new Set(rooms.map((r) => r.icon))
    if (icons.size === 1) {
      for (const r of rooms) {
        r.icon = getServiceUxDefaults(r.name, slug).icon
      }
    }
  }

  let tierNames = parsed.tierNames
  if (!tierNames) {
    tierNames = hints.tierNames
      ? {
          basic: hints.tierNames.basic || 'Basic',
          standard: hints.tierNames.standard || 'Standard',
          premium: hints.tierNames.premium || 'Premium',
        }
      : undefined
  }
  if (tierNames && !isClosets) {
    const labels = [tierNames.basic, tierNames.standard, tierNames.premium].map((s) =>
      (s || '').toLowerCase().trim()
    )
    const allGeneric = labels.every((l) => CLOSET_TIER_DEFAULTS.has(l) || !l)
    if (allGeneric) {
      const profile = getEngineProfile(slug)
      const tiers = profile?.serviceDefaults?.[0]?.tiers
      if (tiers?.length) {
        tierNames = {
          basic: tiers.find((t) => t.tier === 'basic')?.name || tierNames.basic,
          standard: tiers.find((t) => t.tier === 'standard')?.name || tierNames.standard,
          premium: tiers.find((t) => t.tier === 'premium')?.name || tierNames.premium,
        }
      }
    }
  }

  const tierColors = parsed.tierColors || {
    basic: '#94a3b8',
    standard: '#64748b',
    premium: '#0f172a',
  }

  return {
    ...parsed,
    customRooms: rooms,
    tierNames,
    tierColors,
  }
}

/**
 * Use Gemini to generate a bespoke DitchTheForm Pro calculator configuration
 * from the answers a contractor gave during the Pro intake wizard.
 *
 * Returns room pricing, add-ons, finishes, and instructions on which system
 * defaults to disable — ready to be passed directly to `provisionTenant` as
 * `aiWidgetConfig`.
 */
export async function buildWidgetConfig(
  hints: WidgetConfigHints
): Promise<GeneratedWidgetConfig> {
  if (!process.env.GEMINI_API_KEY) {
    return buildFallbackConfig(hints)
  }

  try {
    const noRoomServices = hints.services.length === 0
    const industry = hints.industry?.trim() || 'Custom Closets / Storage'

    const slug = resolveIndustrySlug({
      industry: hints.industry,
      services: hints.services,
      other_services: hints.otherServices,
    })
    const engineProfile = getEngineProfile(slug)
    const isClosets = slug === 'custom-closets'

    let seedPricingStr = formatServiceSeedPricing(hints.services, slug)
    if (!seedPricingStr && hints.seedPricing) {
      seedPricingStr = `Basic ≈ $${hints.seedPricing.basic ?? '?'}, Standard ≈ $${hints.seedPricing.standard ?? '?'}, Premium ≈ $${hints.seedPricing.premium ?? '?'}`
    }
    if (!seedPricingStr && engineProfile?.serviceDefaults?.length) {
      const def = engineProfile.serviceDefaults[0]
      if (def?.tiers?.length) {
        seedPricingStr = def.tiers
          .map(
            (t) =>
              `${t.name}: $${Math.floor(t.priceHint * 0.8)}–$${Math.floor(t.priceHint * 1.4)}`
          )
          .join(', ')
      }
    }
    if (!seedPricingStr) {
      seedPricingStr = `No seed pricing provided — use industry-standard estimates for a premium ${industry} business.`
    }

    const marketStr = formatMarketBounds(hints.marketBounds)
    if (marketStr) {
      seedPricingStr += `\n\nMETRO MARKET BOUNDS (prefer staying inside when samples≥2):\n${marketStr}`
    }

    const iconList = LUCIDE_ICON_ALLOWLIST.join(', ')

    const prompt = `
You are configuring a real-time pricing calculator ("instant quote widget") for a ${industry} business.
The calculator shows prospective customers their estimate in real-time. You MUST generate a configuration that fits
THIS contractor's specific ${industry} business — not a generic default. "Rooms" below is the generic term for the
bookable job types / service categories this business offers (for ${industry} they may be services, vehicle types,
property sizes, etc., NOT literal rooms).

INDUSTRY / TRADE: ${industry}
BUSINESS: ${hints.businessName || `a premium ${industry} contractor`}
SERVICES / JOB TYPES OFFERED: ${noRoomServices ? 'None of the standard list — they work in specialty categories not covered by the standard list' : hints.services.join(', ')}
OTHER SERVICES: ${hints.otherServices || 'None'}
PRICING MODEL: ${hints.pricingModel}
TIER NAMES HINT: Basic="${hints.tierNames?.basic || 'Basic'}", Standard="${hints.tierNames?.standard || 'Standard'}", Premium="${hints.tierNames?.premium || 'Premium'}"
SEED PRICING (per service — use these as starting points; every offered service MUST end non-zero):
${seedPricingStr}
HAS CUSTOM FINISHES/TIERS: ${hints.hasFinishes ? 'Yes' : 'No'}
FINISH/TIER LABELS: ${hints.finishLabels?.map((f) => f.label).join(', ') || 'None — use defaults'}
ADD-ONS OFFERED: ${hints.addOnText || 'None specified'}
CALCULATOR-SPECIFIC NOTES: ${hints.calculatorNotes || 'None provided'}

DEFAULT ROOM LIST (for reference): ${DEFAULT_ROOMS.join(', ')}
ALLOWED LUCIDE ICONS (icon field MUST be one of these exact strings): ${iconList}

Your task: Return a JSON object with this exact structure:
{
  "customRooms": [
    {
      "name": "string",
      "basic": number,
      "standard": number,
      "premium": number,
      "icon": "LucideKeyFromAllowlist",
      "requiresPackage": boolean,
      "requiresMaterials": boolean
    }
  ],
  "customAddOns": [
    { "name": "string", "roomType": "string or null", "price": number }
  ],
  "customFinishes": [
    { "label": "string", "description": "string", "swatchHex": "#RRGGBB", "tier": "basic|standard|premium" }
  ],
  "disabledDefaultRooms": ["room names from the default list to disable"],
  "disableDefaultFinishes": boolean,
  "tierNames": { "basic": "string", "standard": "string", "premium": "string" },
  "tierColors": { "basic": "#RRGGBB", "standard": "#RRGGBB", "premium": "#RRGGBB" }
}

RULES:
1. customRooms: Only include rooms for services they ACTUALLY offer. If they offered services outside the standard room list, create custom room entries for those. EVERY room must have non-zero prices (sum of basic+standard+premium > 0). Prefer the per-service SEED PRICING above.
2. If pricingModel is "fixed", set flat project prices and basic=0, standard=flat_price, premium=high_flat_price when appropriate — but standard and premium must still be non-zero.
3. customAddOns: Parse the add-on text intelligently. Create add-on entries with reasonable prices for a premium contractor. Set roomType to the most relevant room or null for all rooms.
4. customFinishes: Only populate if hasFinishes=true. Use the contractor's finish labels.
5. disabledDefaultRooms: List the default rooms they DON'T offer so we can hide them from their widget.
6. disableDefaultFinishes: true if they have custom finishes that fully replace the defaults, false otherwise.
7. Keep prices realistic for a premium ${industry} company in the US. Use specific starting prices (e.g. $127, $389, $1140) rather than generic round numbers ($100, $200). Do NOT output $0 for all three tiers of any service.
8. Icons: each offered service should get a DISTINCT icon from the allowlist when possible. Do not give every service the same icon.
9. requiresPackage: false for diagnostic/repair/emergency/roadside-style services that don't need a package picker; true otherwise.
10. requiresMaterials: true for materials-heavy trades (wraps, paint, closets, flooring); false for package-only trades.
11. tierNames: use trade-specific package labels (e.g. "Essential / Preferred / Signature" for auto body, "Bronze / Silver / Gold" for service plans). ${isClosets ? 'Closet defaults (Melamine/Wood/Paint) are OK.' : 'Do NOT use closet melamine/wood/paint labels.'}
12. tierColors: three DISTINCT hex swatches that fit a ${industry} brand (not identical).
13. Use CALCULATOR-SPECIFIC NOTES as a strong signal for pricing model nuances.
14. Return ONLY valid JSON — no markdown, no explanation.
`

    const { text } = await generateTextForPurpose('widget_config', {
      prompt,
      jsonMode: true,
      temperature: 0.5,
      maxOutputTokens: 3072,
    })
    const textTrimmed = text.trim()

    const jsonStr = textTrimmed.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(jsonStr) as GeneratedWidgetConfig
    return normalizeGenerated(parsed, hints)
  } catch (err) {
    console.error('[buildWidgetConfig] Gemini call failed, using fallback:', err)
    return buildFallbackConfig(hints)
  }
}

/**
 * Rule-based fallback used when Gemini is unavailable. Applies the hints
 * directly without AI interpretation — still produces a better config than
 * the all-defaults generic setup.
 */
function buildFallbackConfig(hints: WidgetConfigHints): GeneratedWidgetConfig {
  const offeredServices = new Set(hints.services)
  const slug = resolveIndustrySlug({
    industry: hints.industry,
    services: hints.services,
    other_services: hints.otherServices,
  })

  const customRooms = hints.services
    .filter((s) => !DEFAULT_ROOMS.includes(s))
    .map((s) => {
      const tiers = resolveServiceTiers(s, slug)
      const ux = getServiceUxDefaults(s, slug)
      return {
        name: s,
        basic: hints.seedPricing?.basic ?? tiers.basic,
        standard: hints.seedPricing?.standard ?? tiers.standard,
        premium: hints.seedPricing?.premium ?? tiers.premium,
        icon: ux.icon,
        requiresPackage: ux.requiresPackage,
        requiresMaterials: ux.requiresMaterials,
      }
    })

  const disabledDefaultRooms = DEFAULT_ROOMS.filter((r) => !offeredServices.has(r))

  const customAddOns = parseAddOnText(hints.addOnText)

  const customFinishes: GeneratedWidgetConfig['customFinishes'] = []
  if (hints.hasFinishes && hints.finishLabels) {
    const tierMap: Array<'basic' | 'standard' | 'premium'> = ['basic', 'standard', 'premium']
    hints.finishLabels.forEach((f, i) => {
      customFinishes.push({
        label: f.label,
        description: `${f.label} finish option`,
        swatchHex: f.swatchHex || '#A78B6A',
        tier: tierMap[i % 3],
      })
    })
  }

  const profile = getEngineProfile(slug)
  const profileTiers = profile?.serviceDefaults?.[0]?.tiers

  return {
    customRooms,
    customAddOns,
    customFinishes,
    disabledDefaultRooms,
    disableDefaultFinishes: hints.hasFinishes && (hints.finishLabels?.length ?? 0) > 0,
    tierNames: {
      basic: hints.tierNames?.basic || profileTiers?.find((t) => t.tier === 'basic')?.name || 'Basic',
      standard:
        hints.tierNames?.standard ||
        profileTiers?.find((t) => t.tier === 'standard')?.name ||
        'Standard',
      premium:
        hints.tierNames?.premium || profileTiers?.find((t) => t.tier === 'premium')?.name || 'Premium',
    },
    tierColors: { basic: '#94a3b8', standard: '#64748b', premium: '#0f172a' },
  }
}
