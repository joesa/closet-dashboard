/**
 * Per-service mid-market US price seeds for engagement quote engines.
 * Keyed by canonical ServiceDef.label via matchServiceDef; fallback chain:
 * matched label → industry engineProfiles.serviceDefaults[0] → generic trade.
 */
import type { IndustrySlug } from '@/lib/catalog/types'
import { matchServiceDef } from '@/lib/catalog/serviceCatalog'
import { getEngineProfile } from '@/lib/catalog/engineProfiles'

export type ServicePriceEntry = {
  basic?: number
  standard: number
  premium?: number
  unitLabel?: string
  pricingModelHint?: 'per_unit' | 'flat_tiered' | 'base_plus_distance'
}

export type TierDefaults = { basic: number; standard: number; premium: number }

/** Concrete mid-market ranges — not round $100/$200 placeholders. */
const BY_LABEL: Record<string, ServicePriceEntry> = {
  // Auto body / wraps
  'Collision Repair': { basic: 890, standard: 2450, premium: 6850, pricingModelHint: 'flat_tiered' },
  'Auto Painting': { basic: 420, standard: 1850, premium: 4200, pricingModelHint: 'flat_tiered' },
  'Paintless Dent Repair (PDR)': { basic: 125, standard: 385, premium: 980, pricingModelHint: 'flat_tiered' },
  'Scratch & Chip Repair': { basic: 95, standard: 275, premium: 640, pricingModelHint: 'flat_tiered' },
  'Frame & Structural Repair': { basic: 1250, standard: 3800, premium: 9200, pricingModelHint: 'flat_tiered' },
  'Bumper Repair & Replacement': { basic: 285, standard: 725, premium: 1450, pricingModelHint: 'flat_tiered' },
  'Glass & Windshield': { basic: 165, standard: 385, premium: 720, pricingModelHint: 'flat_tiered' },
  'Auto Wrapping': { basic: 1450, standard: 3250, premium: 5800, pricingModelHint: 'flat_tiered' },

  // Mobile auto / detailing
  'Mobile Auto Detailing': { basic: 125, standard: 249, premium: 475, pricingModelHint: 'flat_tiered' },
  'Ceramic Coating': { basic: 650, standard: 1450, premium: 2850, pricingModelHint: 'flat_tiered' },
  'Paint Correction': { basic: 350, standard: 850, premium: 1650, pricingModelHint: 'flat_tiered' },
  'Interior Detailing': { basic: 95, standard: 185, premium: 325, pricingModelHint: 'flat_tiered' },

  // Plumbing
  'Drain Cleaning': { basic: 129, standard: 249, premium: 485, pricingModelHint: 'flat_tiered' },
  'Water Heater Repair & Install': { basic: 285, standard: 1250, premium: 2850, pricingModelHint: 'flat_tiered' },
  'Leak Detection & Repair': { basic: 175, standard: 425, premium: 980, pricingModelHint: 'flat_tiered' },
  'Fixture Install & Repair': { basic: 145, standard: 325, premium: 685, pricingModelHint: 'flat_tiered' },
  'Sewer Line Service': { basic: 385, standard: 1450, premium: 4850, pricingModelHint: 'flat_tiered' },
  'Repiping & Pipe Replacement': { basic: 850, standard: 4500, premium: 12500, pricingModelHint: 'flat_tiered' },
  'Bathroom Remodel Plumbing': { basic: 2200, standard: 6500, premium: 14500, pricingModelHint: 'flat_tiered' },
  'Kitchen Plumbing': { basic: 450, standard: 1450, premium: 3800, pricingModelHint: 'flat_tiered' },
  'Gas Line Install & Repair': { basic: 225, standard: 685, premium: 1650, pricingModelHint: 'flat_tiered' },
  'Emergency Plumbing': { basic: 195, standard: 385, premium: 750, pricingModelHint: 'flat_tiered' },
  'Water Filtration & Softeners': { basic: 485, standard: 1450, premium: 3200, pricingModelHint: 'flat_tiered' },
  'Commercial Plumbing': { basic: 350, standard: 950, premium: 2800, pricingModelHint: 'flat_tiered' },

  // HVAC
  'AC Repair & Service': { basic: 129, standard: 285, premium: 685, pricingModelHint: 'flat_tiered' },
  'AC Installation & Replacement': { basic: 3200, standard: 5850, premium: 9800, pricingModelHint: 'flat_tiered' },
  'Furnace Repair & Service': { basic: 145, standard: 325, premium: 750, pricingModelHint: 'flat_tiered' },
  'Furnace Installation & Replacement': { basic: 2800, standard: 4850, premium: 8200, pricingModelHint: 'flat_tiered' },
  'Heat Pump Service': { basic: 165, standard: 385, premium: 890, pricingModelHint: 'flat_tiered' },
  'Duct Cleaning & Sealing': { basic: 285, standard: 525, premium: 980, pricingModelHint: 'flat_tiered' },
  'Indoor Air Quality': { basic: 225, standard: 685, premium: 1850, pricingModelHint: 'flat_tiered' },
  'Thermostat & Smart Home': { basic: 145, standard: 325, premium: 685, pricingModelHint: 'flat_tiered' },
  'Commercial HVAC': { basic: 385, standard: 1250, premium: 4500, pricingModelHint: 'flat_tiered' },
  'Emergency HVAC': { basic: 195, standard: 425, premium: 850, pricingModelHint: 'flat_tiered' },
  'Maintenance Plans': { basic: 89, standard: 179, premium: 329, pricingModelHint: 'flat_tiered' },

  // Cleaning
  'Regular House Cleaning': { basic: 115, standard: 175, premium: 265, unitLabel: 'per visit' },
  'Deep Cleaning': { basic: 185, standard: 325, premium: 525, pricingModelHint: 'flat_tiered' },
  'Move-In / Move-Out Cleaning': { basic: 225, standard: 385, premium: 625, pricingModelHint: 'flat_tiered' },
  'Carpet & Upholstery Cleaning': { basic: 95, standard: 185, premium: 345, unitLabel: 'per room' },
  'Window Cleaning': { basic: 125, standard: 245, premium: 425, pricingModelHint: 'flat_tiered' },
  'Post-Construction Cleaning': { basic: 285, standard: 585, premium: 1150, pricingModelHint: 'flat_tiered' },
  'Commercial Office Cleaning': { basic: 0.12, standard: 0.18, premium: 0.28, unitLabel: 'per sq ft' },
  'Exterior / Pressure Washing': { basic: 185, standard: 385, premium: 750, pricingModelHint: 'flat_tiered' },
  'Airbnb / Short-Term Rental Cleaning': { basic: 95, standard: 145, premium: 225, pricingModelHint: 'flat_tiered' },

  // Landscaping
  'Lawn Care & Mowing': { basic: 45, standard: 75, premium: 125, unitLabel: 'per visit' },
  'Landscape Design & Install': { basic: 1850, standard: 6500, premium: 18500, pricingModelHint: 'flat_tiered' },
  'Hardscaping & Patios': { basic: 2800, standard: 8500, premium: 22000, pricingModelHint: 'flat_tiered' },
  'Irrigation & Sprinklers': { basic: 385, standard: 1450, premium: 4200, pricingModelHint: 'flat_tiered' },
  'Tree & Shrub Care': { basic: 185, standard: 485, premium: 1250, pricingModelHint: 'flat_tiered' },
  'Mulching & Bed Maintenance': { basic: 225, standard: 485, premium: 980, pricingModelHint: 'flat_tiered' },
  'Outdoor Lighting': { basic: 650, standard: 1850, premium: 4500, pricingModelHint: 'flat_tiered' },
  'Sod & Turf Installation': { basic: 0.85, standard: 1.45, premium: 2.85, unitLabel: 'per sq ft' },
  'Seasonal Cleanup': { basic: 185, standard: 385, premium: 750, pricingModelHint: 'flat_tiered' },
  'Commercial Landscaping': { basic: 285, standard: 685, premium: 1850, pricingModelHint: 'flat_tiered' },

  // Roofing
  'Roof Replacement': { basic: 6500, standard: 12500, premium: 24500, pricingModelHint: 'flat_tiered' },
  'Roof Repair': { basic: 285, standard: 685, premium: 1850, pricingModelHint: 'flat_tiered' },
  'Storm & Hail Damage': { basic: 450, standard: 2850, premium: 9800, pricingModelHint: 'flat_tiered' },
  'Shingle Roofing': { basic: 4.85, standard: 7.25, premium: 11.5, unitLabel: 'per sq ft' },
  'Metal Roofing': { basic: 8.5, standard: 12.75, premium: 18.5, unitLabel: 'per sq ft' },
  'Flat & Commercial Roofing': { basic: 5.25, standard: 8.5, premium: 14.25, unitLabel: 'per sq ft' },
  'Gutter Install & Repair': { basic: 8.5, standard: 14.5, premium: 24, unitLabel: 'per linear ft' },
  'Roof Inspection': { basic: 125, standard: 225, premium: 385, pricingModelHint: 'flat_tiered' },
  'Skylight Install & Repair': { basic: 650, standard: 1450, premium: 3200, pricingModelHint: 'flat_tiered' },
  'Roof Ventilation & Insulation': { basic: 485, standard: 1450, premium: 3850, pricingModelHint: 'flat_tiered' },

  // Electrical
  'Panel Upgrade & Service': { basic: 850, standard: 1850, premium: 3850, pricingModelHint: 'flat_tiered' },
  'Outlet & Switch Install': { basic: 125, standard: 225, premium: 385, pricingModelHint: 'flat_tiered' },
  'Lighting Design & Install': { basic: 285, standard: 850, premium: 2450, pricingModelHint: 'flat_tiered' },
  'EV Charger Installation': { basic: 650, standard: 1250, premium: 2450, pricingModelHint: 'flat_tiered' },
  'Whole-Home Rewiring': { basic: 8500, standard: 16500, premium: 32000, pricingModelHint: 'flat_tiered' },
  'Ceiling Fan Install': { basic: 145, standard: 245, premium: 385, pricingModelHint: 'flat_tiered' },
  'Generator Install & Hookup': { basic: 2800, standard: 6500, premium: 14500, pricingModelHint: 'flat_tiered' },
  'Smart Home & Automation': { basic: 385, standard: 1250, premium: 4500, pricingModelHint: 'flat_tiered' },
  'Commercial Electrical': { basic: 285, standard: 850, premium: 2800, pricingModelHint: 'flat_tiered' },
  'Emergency Electrical': { basic: 195, standard: 385, premium: 750, pricingModelHint: 'flat_tiered' },
  'Surge Protection & Safety': { basic: 225, standard: 485, premium: 980, pricingModelHint: 'flat_tiered' },

  // Towing
  'Light-Duty Towing': { basic: 85, standard: 125, premium: 185, unitLabel: 'hookup + per mile', pricingModelHint: 'base_plus_distance' },
  'Heavy-Duty Towing': { basic: 185, standard: 325, premium: 550, unitLabel: 'hookup + per mile', pricingModelHint: 'base_plus_distance' },
  'Roadside Assistance': { basic: 65, standard: 95, premium: 145, pricingModelHint: 'flat_tiered' },
  'Accident Recovery': { basic: 145, standard: 285, premium: 485, pricingModelHint: 'flat_tiered' },
  'Winch-Out & Off-Road Recovery': { basic: 125, standard: 225, premium: 385, pricingModelHint: 'flat_tiered' },
  'Flatbed Transport': { basic: 95, standard: 155, premium: 245, unitLabel: 'hookup + per mile', pricingModelHint: 'base_plus_distance' },
  'Motorcycle Towing': { basic: 85, standard: 135, premium: 195, pricingModelHint: 'flat_tiered' },
  'Fleet & Commercial Towing': { basic: 125, standard: 225, premium: 385, pricingModelHint: 'base_plus_distance' },
  'Impound & Private Property Towing': { basic: 95, standard: 145, premium: 225, pricingModelHint: 'flat_tiered' },
  'Long-Distance Towing': { basic: 1.85, standard: 2.85, premium: 4.25, unitLabel: 'per mile', pricingModelHint: 'base_plus_distance' },
}

const GENERIC_TRADE: TierDefaults = { basic: 89, standard: 175, premium: 385 }

function entryToTiers(entry: ServicePriceEntry): TierDefaults {
  const standard = entry.standard
  const basic =
    entry.basic !== undefined && entry.basic !== null
      ? entry.basic
      : Math.max(0, Math.round(standard * 0.7 * 100) / 100)
  const premium =
    entry.premium !== undefined && entry.premium !== null
      ? entry.premium
      : Math.round(standard * 1.6 * 100) / 100
  return { basic, standard, premium }
}

function engineProfileTiers(slug: IndustrySlug): TierDefaults | null {
  const tiers = getEngineProfile(slug)?.serviceDefaults?.[0]?.tiers ?? []
  if (!tiers.length) return null
  const hintFor = (tier: 'basic' | 'standard' | 'premium') =>
    tiers.find((t) => t.tier === tier)?.priceHint
  const standard = hintFor('standard') ?? tiers[0]?.priceHint ?? GENERIC_TRADE.standard
  const basic = hintFor('basic') ?? Math.max(1, Math.round(standard * 0.7))
  const premium = hintFor('premium') ?? Math.round(standard * 1.6)
  return { basic, standard, premium }
}

/** Lookup catalog entry by free-text service name (via matchServiceDef). */
export function lookupServicePriceEntry(
  serviceName: string,
  industrySlug?: IndustrySlug
): ServicePriceEntry | null {
  const def = matchServiceDef(serviceName, industrySlug)
  if (def?.label && BY_LABEL[def.label]) return BY_LABEL[def.label]
  const exact = BY_LABEL[serviceName.trim()]
  if (exact) return exact
  return null
}

/**
 * Resolve tier defaults for one service name.
 * Chain: matched catalog label → industry engine profile → generic trade.
 */
export function resolveServiceTiers(
  serviceName: string,
  industrySlug?: IndustrySlug
): TierDefaults {
  const entry = lookupServicePriceEntry(serviceName, industrySlug)
  if (entry) return entryToTiers(entry)

  if (industrySlug) {
    const fromProfile = engineProfileTiers(industrySlug)
    if (fromProfile) return fromProfile
  }

  const def = matchServiceDef(serviceName, industrySlug)
  if (def?.industry) {
    const fromIndustry = engineProfileTiers(def.industry as IndustrySlug)
    if (fromIndustry) return fromIndustry
  }

  return { ...GENERIC_TRADE }
}

/** Format per-service seed lines for the AI buildWidgetConfig prompt. */
export function formatServiceSeedPricing(
  services: string[],
  industrySlug?: IndustrySlug
): string {
  if (!services.length) return ''
  return services
    .filter((s) => s.trim())
    .map((s) => {
      const t = resolveServiceTiers(s, industrySlug)
      const entry = lookupServicePriceEntry(s, industrySlug)
      const unit = entry?.unitLabel ? ` (${entry.unitLabel})` : ''
      return `- ${s}: basic≈$${t.basic}, standard≈$${t.standard}, premium≈$${t.premium}${unit}`
    })
    .join('\n')
}

export function getCatalogLabelKeys(): string[] {
  return Object.keys(BY_LABEL)
}
