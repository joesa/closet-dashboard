export interface AddOnCatalogItem {
  id: string
  name: string
  price: number | string
}

export interface RequestedAddOn {
  id: string
  quantity: number
}

export interface ExpandedAddOn {
  id: string
  name: string
  quantity: number
  price: number
}

export interface QuoteResult {
  baseCost: number
  addOnCost: number
  expandedAddOns: ExpandedAddOn[]
  estimatedTotal: number
  range: { low: number; high: number }
}

/**
 * How the base cost (before add-ons) is computed for a vertical:
 * - `per_unit`            base = ratePerUnit * quantity   (closets: $/ft * linear feet,
 *                         pressure wash: $/ft², tree removal: $/tree)
 * - `flat_tiered`         base = ratePerUnit              (flat job price per tier;
 *                         quantity ignored — plumbing fixtures, tow hookup)
 * - `base_plus_distance`  base = baseFee + ratePerUnit * quantity  (towing: hookup + $/mile)
 */
export type PricingModel = 'per_unit' | 'flat_tiered' | 'base_plus_distance'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** +/-15% range matches widget ballpark UX. */
export function computeQuote(params: {
  /** Defaults to 'per_unit' so legacy closet callers behave unchanged. */
  pricingModel?: PricingModel
  /** Generic rate. Legacy alias: `perFoot`. */
  ratePerUnit?: number
  /** Generic quantity (units / distance). Legacy alias: `linearFeet`. */
  quantity?: number
  /** Flat hookup/base fee for `base_plus_distance` (and optional `flat_tiered`). */
  baseFee?: number
  /** @deprecated closet alias for `ratePerUnit`. */
  perFoot?: number
  /** @deprecated closet alias for `quantity`. */
  linearFeet?: number
  requestedAddOns?: RequestedAddOn[] | null
  addOnCatalog?: AddOnCatalogItem[] | null
}): QuoteResult {
  const pricingModel: PricingModel = params.pricingModel ?? 'per_unit'
  const ratePerUnit = Number(params.ratePerUnit ?? params.perFoot) || 0
  const quantity = Number(params.quantity ?? params.linearFeet) || 0
  const baseFee = Number(params.baseFee) || 0

  let baseCost: number
  switch (pricingModel) {
    case 'flat_tiered':
      // The tier rate is itself the flat job price; quantity does not scale it.
      baseCost = ratePerUnit
      break
    case 'base_plus_distance':
      baseCost = baseFee + ratePerUnit * quantity
      break
    case 'per_unit':
    default:
      baseCost = ratePerUnit * quantity
      break
  }

  let addOnCost = 0
  const expandedAddOns: ExpandedAddOn[] = []
  const catalog = params.addOnCatalog ?? []
  const requested = params.requestedAddOns ?? []

  if (catalog.length && Array.isArray(requested)) {
    for (const item of requested) {
      const addonInfo = catalog.find((a) => a.id === item.id)
      if (!addonInfo) continue
      const price = Number(addonInfo.price) || 0
      const quantity = Number(item.quantity) || 0
      addOnCost += price * quantity
      expandedAddOns.push({
        id: addonInfo.id,
        name: addonInfo.name,
        quantity,
        price,
      })
    }
  }

  const total = baseCost + addOnCost

  return {
    baseCost: round2(baseCost),
    addOnCost: round2(addOnCost),
    expandedAddOns,
    estimatedTotal: round2(total),
    range: { low: round2(total * 0.85), high: round2(total * 1.15) },
  }
}
