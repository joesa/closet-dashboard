import { getIndustry } from '@/lib/catalog/serviceCatalog'
import { resolveServiceTiers } from '@/lib/catalog/servicePriceCatalog'
import { inferQuoteCalculatorGuidance } from '@/lib/quoteCalculatorGuidance'
import type { IndustrySlug } from '@/lib/catalog/types'

/**
 * Give a newly provisioned widget a few real, priced add-ons.
 *
 * Extracted from provisionTenant.ts so that callers who need only this helper
 * do not import provisioning wholesale. That mattered in production: the widget
 * signup route (`/api/intake/pro/start`) imported it from provisionTenant,
 * which statically imports the image-generation stack, which loads `sharp` — a
 * native module. When sharp failed to load in the Vercel runtime the whole
 * route returned 500 at module init, before any handler code (including its
 * auth check) could run, so the failure surfaced as an unhandled framework
 * error rather than a JSON response. A small pure helper has no business
 * dragging libvips into a JSON endpoint's bundle.
 *
 * Behaviour is unchanged: never overrides add-ons the AI or an admin already
 * supplied — only backfills a missing price on those, and only invents
 * industry-typical add-ons when there was nothing to work with at all.
 */
export function mergeCustomAddOnsWithDefaults(
  customAddOns: Array<{ name: string; roomType?: string; price?: number }>,
  industrySlug: IndustrySlug,
  services: string[] | null | undefined
): Array<{ name: string; roomType?: string; price: number }> {
  if (customAddOns.length > 0) {
    return customAddOns.map((a) => ({
      ...a,
      price:
        typeof a.price === 'number' && a.price > 0
          ? a.price
          : resolveServiceTiers(a.name, industrySlug).basic,
    }))
  }
  const guidance = inferQuoteCalculatorGuidance({
    industry: getIndustry(industrySlug).label,
    services: services || undefined,
  })
  return guidance.addOnExamples.slice(0, 4).map((name) => ({
    name,
    price: resolveServiceTiers(name, industrySlug).basic,
  }))
}
