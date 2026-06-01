export type IntakeTierSlug = 'standard' | 'ai_premium'

export type IntakeTierCatalogEntry = {
  slug: IntakeTierSlug
  label: string
  totalCents: number
  depositCents: number
  remainderCents: number
  requiresDeposit: boolean
  hasImageStudio: boolean
}

function parseCents(envKey: string, fallback: number): number {
  const raw = process.env[envKey]
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

export function getTierCatalog(): IntakeTierCatalogEntry[] {
  const standardCents = parseCents('INTAKE_TIER_STANDARD_CENTS', 0)
  const premiumCents = parseCents('INTAKE_TIER_AI_PREMIUM_CENTS', 199900)

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
    },
    {
      slug: 'ai_premium',
      label: 'AI Premium',
      totalCents: premiumCents,
      depositCents: premiumDeposit,
      remainderCents: premiumCents - premiumDeposit,
      requiresDeposit: premiumDeposit > 0,
      hasImageStudio: true,
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
