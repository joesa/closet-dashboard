import { generateTextWithFallback } from '@/lib/ai/aiTextProvider'
import { resolveIndustrySlug } from '@/lib/catalog/serviceCatalog'
import { getEngineProfile } from '@/lib/catalog/engineProfiles'

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
}

export type GeneratedWidgetConfig = {
  customRooms: Array<{
    name: string
    basic: number
    standard: number
    premium: number
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
    
    let seedPricingStr = hints.seedPricing
      ? `Basic ≈ $${hints.seedPricing.basic ?? '?'}, Standard ≈ $${hints.seedPricing.standard ?? '?'}, Premium ≈ $${hints.seedPricing.premium ?? '?'}`
      : ''
      
    if (!hints.seedPricing && engineProfile?.serviceDefaults?.length > 0) {
      const def = engineProfile.serviceDefaults[0]
      if (def?.tiers?.length > 0) {
        seedPricingStr = def.tiers.map((t) => `${t.name}: $${Math.floor(t.priceHint * 0.8)}–$${Math.floor(t.priceHint * 1.4)}`).join(', ')
      }
    }

    if (!seedPricingStr) {
      seedPricingStr = `No seed pricing provided — use industry-standard estimates for a premium ${industry} business.`
    }

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
TIER NAMES: Basic="${hints.tierNames?.basic || 'Basic'}", Standard="${hints.tierNames?.standard || 'Standard'}", Premium="${hints.tierNames?.premium || 'Premium'}"
SEED PRICING: ${seedPricingStr}
HAS CUSTOM FINISHES/TIERS: ${hints.hasFinishes ? 'Yes' : 'No'}
FINISH/TIER LABELS: ${hints.finishLabels?.map((f) => f.label).join(', ') || 'None — use defaults'}
ADD-ONS OFFERED: ${hints.addOnText || 'None specified'}
CALCULATOR-SPECIFIC NOTES: ${hints.calculatorNotes || 'None provided'}

DEFAULT ROOM LIST (for reference): ${DEFAULT_ROOMS.join(', ')}

Your task: Return a JSON object with this exact structure:
{
  "customRooms": [
    { "name": "string", "basic": number, "standard": number, "premium": number }
  ],
  "customAddOns": [
    { "name": "string", "roomType": "string or null", "price": number }
  ],
  "customFinishes": [
    { "label": "string", "description": "string", "swatchHex": "#RRGGBB", "tier": "basic|standard|premium" }
  ],
  "disabledDefaultRooms": ["room names from the default list to disable"],
  "disableDefaultFinishes": boolean
}

RULES:
1. customRooms: Only include rooms for services they ACTUALLY offer. If they do walk-in closets, pantries, and garages — only configure those. If they offered services outside the standard room list (e.g. "custom wine cellars", "safe rooms"), create custom room entries for those.
2. If pricingModel is "fixed", set all price values to flat project prices (not per-foot), and set basic=0, standard=flat_price, premium=high_flat_price pattern.
3. customAddOns: Parse the add-on text intelligently. Create add-on entries with reasonable prices for a premium contractor. Set roomType to the most relevant room or null for all rooms.
4. customFinishes: Only populate if hasFinishes=true. Use the contractor's finish labels. Assign appropriate swatch hex colors. Map to tiers logically (entry=basic, mid=standard, premium=premium).
5. disabledDefaultRooms: List the default rooms they DON'T offer so we can hide them from their widget.
6. disableDefaultFinishes: true if they have custom finishes that fully replace the defaults, false otherwise.
7. Keep prices realistic for a premium ${industry} company in the US. You MUST use your best knowledge of the ${industry} industry to provide sensible, specific starting prices (e.g. $127, $389, $1140) rather than generic round numbers ($100, $200). Do NOT output $0 or null for ANY prices.
8. Use CALCULATOR-SPECIFIC NOTES as a strong signal for what should affect price, which services should be flat-rate vs measured, and which upgrades deserve add-on cards.
9. Return ONLY valid JSON — no markdown, no explanation.
`

    const { text } = await generateTextWithFallback({
      prompt,
      jsonMode: true,
      temperature: 0.5,
      maxOutputTokens: 2048,
    })
    const textTrimmed = text.trim()

    // Strip markdown code fences if present
    const jsonStr = textTrimmed.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(jsonStr) as GeneratedWidgetConfig
    return parsed
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

  const customRooms = hints.services
    .filter((s) => !DEFAULT_ROOMS.includes(s)) // only create custom rows for non-default rooms
    .map((s) => ({
      name: s,
      basic: hints.seedPricing?.basic ?? 45,
      standard: hints.seedPricing?.standard ?? 65,
      premium: hints.seedPricing?.premium ?? 110,
    }))

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

  return {
    customRooms,
    customAddOns,
    customFinishes,
    disabledDefaultRooms,
    disableDefaultFinishes: hints.hasFinishes && (hints.finishLabels?.length ?? 0) > 0,
  }
}
