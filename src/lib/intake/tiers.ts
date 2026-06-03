import { maxPagesForTier } from '@/lib/catalog/sitePages'

export type IntakeTierSlug = 'standard' | 'ai_premium'

/** Managed hosting + ClosetQuote Pro after the one-time site build. */
export type SiteMaintenancePricing = {
  monthlyCents: number
  yearlyCents: number
  /** Monthly × 12 − yearly (e.g. two months free). */
  yearlySavingsCents: number
  effectiveMonthlyFromYearlyCents: number
}

export type IntakeTierCatalogEntry = {
  slug: IntakeTierSlug
  label: string
  totalCents: number
  depositCents: number
  remainderCents: number
  requiresDeposit: boolean
  hasImageStudio: boolean
  /** Max total pages (Home included) this build tier ships. */
  maxPages: number
  maintenance: SiteMaintenancePricing
}

function parseCents(envKey: string, fallback: number): number {
  const publicKey = `NEXT_PUBLIC_${envKey}`
  const raw = process.env[envKey] ?? process.env[publicKey]
  if (!raw) return fallback
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

/** 30% upfront for AI premium (rounded up). */
export function depositForTier(totalCents: number): number {
  if (totalCents <= 0) return 0
  return Math.ceil(totalCents * 0.3)
}

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

/**
 * Ongoing site maintenance (both build tiers). Defaults: $149/mo or $1,490/yr
 * (two months free vs monthly — same structure as ClosetQuote Pro widget yearly).
 */
/** ClosetQuote Pro widget-only subscription (existing website). */
export function getWidgetSubscriptionPricing(): SiteMaintenancePricing {
  const monthlyCents = parseCents('WIDGET_SUBSCRIPTION_MONTHLY_CENTS', 9900)
  const yearlyCents = parseCents('WIDGET_SUBSCRIPTION_YEARLY_CENTS', 99000)
  const yearlySavingsCents = Math.max(0, monthlyCents * 12 - yearlyCents)
  return {
    monthlyCents,
    yearlyCents,
    yearlySavingsCents,
    effectiveMonthlyFromYearlyCents: Math.round(yearlyCents / 12),
  }
}

export function getSiteMaintenancePricing(): SiteMaintenancePricing {
  const monthlyCents = parseCents('SITE_MAINTENANCE_MONTHLY_CENTS', 14900)
  const yearlyCents = parseCents('SITE_MAINTENANCE_YEARLY_CENTS', 149000)
  const yearlySavingsCents = Math.max(0, monthlyCents * 12 - yearlyCents)
  return {
    monthlyCents,
    yearlyCents,
    yearlySavingsCents,
    effectiveMonthlyFromYearlyCents: Math.round(yearlyCents / 12),
  }
}

export function subscriptionBillingDisplay(
  billing: 'monthly' | 'yearly',
  pricing: SiteMaintenancePricing
): { perMonthCents: number; billedLabel: string } {
  if (billing === 'yearly') {
    return {
      perMonthCents: pricing.effectiveMonthlyFromYearlyCents,
      billedLabel: `${formatUsd(pricing.yearlyCents)} billed yearly`,
    }
  }
  return {
    perMonthCents: pricing.monthlyCents,
    billedLabel: 'Billed monthly',
  }
}

export function maintenanceDisplay(
  billing: 'monthly' | 'yearly',
  maintenance: SiteMaintenancePricing = getSiteMaintenancePricing()
): { perMonthCents: number; billedLabel: string } {
  const base = subscriptionBillingDisplay(billing, maintenance)
  if (billing === 'monthly') {
    return { ...base, billedLabel: 'Billed monthly after launch' }
  }
  return base
}

export function getTierCatalog(): IntakeTierCatalogEntry[] {
  const standardCents = parseCents('INTAKE_TIER_STANDARD_CENTS', 99900)
  const premiumCents = parseCents('INTAKE_TIER_AI_PREMIUM_CENTS', 199900)
  const maintenance = getSiteMaintenancePricing()

  const standardDeposit = 0
  const premiumDeposit = depositForTier(premiumCents)

  return [
    {
      slug: 'standard',
      label: 'Standard',
      totalCents: standardCents,
      depositCents: standardDeposit,
      remainderCents: standardCents - standardDeposit,
      requiresDeposit: false,
      hasImageStudio: false,
      maxPages: maxPagesForTier('standard'),
      maintenance,
    },
    {
      slug: 'ai_premium',
      label: 'AI Premium',
      totalCents: premiumCents,
      depositCents: premiumDeposit,
      remainderCents: premiumCents - premiumDeposit,
      requiresDeposit: premiumDeposit > 0,
      hasImageStudio: true,
      maxPages: maxPagesForTier('ai_premium'),
      maintenance,
    },
  ]
}

export function getTierEntry(slug: IntakeTierSlug): IntakeTierCatalogEntry | undefined {
  return getTierCatalog().find((t) => t.slug === slug)
}

export function depositStatusForTier(
  tier: IntakeTierSlug,
  paidCents: number,
  requiredCents: number
): 'not_required' | 'pending' | 'paid' {
  if (tier !== 'ai_premium' || requiredCents <= 0) return 'not_required'
  if (paidCents >= requiredCents) return 'paid'
  return 'pending'
}
