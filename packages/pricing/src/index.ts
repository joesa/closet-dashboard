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

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** +/-15% range matches widget ballpark UX. */
export function computeQuote(params: {
  perFoot: number
  linearFeet: number
  requestedAddOns?: RequestedAddOn[] | null
  addOnCatalog?: AddOnCatalogItem[] | null
}): QuoteResult {
  const perFoot = Number(params.perFoot) || 0
  const linearFeet = Number(params.linearFeet) || 0
  const baseCost = perFoot * linearFeet

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
