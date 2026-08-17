import type { IndustryDef } from '@/lib/catalog/types'

/**
 * The zero-signal fallback industry.
 *
 * `resolveIndustrySlug` used to end with `?? 'custom-closets'`, so a trade that
 * matched nothing in the catalog — a publishing house, a wildlife-removal
 * outfit, a dental practice — was provisioned with the closet vertical's widget
 * config and quoted in Linear Feet, per Room, with a Finish tier. The default
 * has to be *something* (every caller expects a slug, and both
 * INDUSTRY_CONFIGS and INDUSTRY_BEFORE_AFTER_CATEGORY are exhaustive maps), so
 * it may as well be a trade-neutral entry that reads correctly for any business:
 * a service, scoped per job, priced in packages.
 *
 * Deliberately carries NO services and NO keywords. Services would join
 * ALL_SERVICES and a generic label like "Consultation" would start winning
 * matches away from real industries; keywords would let it be resolved by text
 * instead of only as the explicit last resort. It is reachable exactly one way:
 * nothing else scored.
 *
 * Excluded from `listIndustries()` for the same reason — it is where you land,
 * never something an admin or a model should pick.
 */
export const GENERIC_TRADE_INDUSTRY: IndustryDef = {
  slug: 'generic-trade',
  label: 'General Trade',
  keywords: [],
  serviceGroups: ['Services'],
  defaultThemes: ['modern-office', 'functional-utility', 'classic-warm', 'minimalist-zen'],
  defaultLayouts: ['standard', 'trust-builder', 'conversion-focus', 'local-expert'],
  services: [],
}
