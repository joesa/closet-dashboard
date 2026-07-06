/**
 * DitchTheForm Stripe Price IDs (see scripts/stripe-setup-catalog.mjs).
 * Lookup keys in Stripe: cq_pro_monthly, cq_standard_build_onetime, etc.
 */

export const STRIPE_LOOKUP_KEYS = {
  proMonthly: 'cq_pro_monthly',
  proYearly: 'cq_pro_yearly',
  standardBuild: 'cq_standard_build_onetime',
  aiPremiumFull: 'cq_ai_premium_full',
  aiPremiumDeposit: 'cq_ai_premium_deposit',
  aiPremiumBalance: 'cq_ai_premium_balance',
  siteMaintenanceMonthly: 'cq_site_maintenance_monthly',
  siteMaintenanceYearly: 'cq_site_maintenance_yearly',
} as const

export function stripePriceEnv() {
  return {
    proMonthly: process.env.STRIPE_PRICE_MONTHLY,
    proYearly: process.env.STRIPE_PRICE_YEARLY,
    standardBuild: process.env.STRIPE_PRICE_STANDARD_BUILD,
    aiPremiumFull: process.env.STRIPE_PRICE_AI_PREMIUM_FULL,
    aiPremiumDeposit: process.env.STRIPE_PRICE_AI_PREMIUM_DEPOSIT,
    aiPremiumBalance: process.env.STRIPE_PRICE_AI_PREMIUM_BALANCE,
    siteMaintenanceMonthly: process.env.STRIPE_PRICE_SITE_MAINTENANCE_MONTHLY,
    siteMaintenanceYearly: process.env.STRIPE_PRICE_SITE_MAINTENANCE_YEARLY,
  }
}

/** Use catalog price when configured and amount matches (cents). */
export function resolveOneTimePriceId(
  envPriceId: string | undefined,
  requiredCents: number,
  catalogCents: number
): string | null {
  if (!envPriceId) return null
  if (requiredCents === catalogCents) return envPriceId
  return null
}
