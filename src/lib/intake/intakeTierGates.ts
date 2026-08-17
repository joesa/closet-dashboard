import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'
import {
  depositStatusForTier,
  getTierEntry,
  isDepositCleared,
  type IntakeTierSlug,
} from '@/lib/intake/tiers'

/** AI Premium 30% deposit from catalog (authoritative when row fields are stale). */
export function premiumDepositRequiredCents(): number {
  return getTierEntry('ai_premium')?.depositCents ?? 0
}

/** True when the prospect has paid at least the AI Premium deposit amount. */
export function hasPaidPremiumDeposit(row: ProspectIntakeRow): boolean {
  const required = premiumDepositRequiredCents()
  return required > 0 && row.deposit_paid_cents >= required
}

/**
 * Resolve the tier the prospect is entitled to. Heals the common case where a
 * paid AI Premium deposit exists but `intake_tier` was downgraded to Standard
 * (e.g. re-clicking a generic verify link that re-applies Standard).
 */
export function effectiveIntakeTier(row: ProspectIntakeRow): IntakeTierSlug {
  if (row.intake_tier === 'ai_premium') return 'ai_premium'
  if (hasPaidPremiumDeposit(row)) return 'ai_premium'
  return 'standard'
}

export function depositSatisfied(row: ProspectIntakeRow): boolean {
  const tier = effectiveIntakeTier(row)
  if (tier !== 'ai_premium') return true
  // Spec builds owe nothing up front — we build first and ask afterwards. This
  // must be checked before the catalog fallback below, which would otherwise
  // reinstate the full list deposit for a row whose requirement is zero.
  if (isDepositCleared(row.deposit_status)) return true
  const required =
    row.deposit_required_cents > 0
      ? row.deposit_required_cents
      : premiumDepositRequiredCents()
  if (required <= 0) return true
  if (row.deposit_status === 'paid') return true
  return row.deposit_paid_cents >= required
}

export function canUseImageStudio(row: ProspectIntakeRow): boolean {
  return effectiveIntakeTier(row) === 'ai_premium' && depositSatisfied(row)
}

/**
 * Gate for the features AI Premium actually pays for: generated imagery.
 *
 * It used to gate the text pipeline too, which meant a Standard prospect
 * answered nine proprietary-fact questions and none of them ever reached a
 * generator — `buildIntakeBrief` is only called from routes behind this gate.
 * That is the wrong seam: assembling a brief is a text concatenation plus one
 * enhancer call, while image generation is the real per-site cost. Tiers now
 * differ on imagery, page count, and human review; both tiers get the facts
 * they typed. See assertGeneratedImageryAccess below for the imagery gate and
 * src/lib/intake/factLedger.ts for what Standard now keeps.
 */
export function assertPremiumAiAccess(row: ProspectIntakeRow): string | null {
  if (effectiveIntakeTier(row) !== 'ai_premium') {
    return 'AI features are only available on the AI Premium tier.'
  }
  if (!depositSatisfied(row)) {
    return 'Pay the 30% deposit to unlock AI features.'
  }
  return null
}

/** @deprecated Use assertPremiumAiAccess — kept as alias for existing imports. */
export function assertDepositPaid(row: ProspectIntakeRow): string | null {
  return assertPremiumAiAccess(row)
}

/**
 * The text pipeline: available on every tier, bounded instead of withheld.
 *
 * Standard still cannot run the image studio or exceed its page cap, and the
 * caller is expected to pass `standardPassBudget()` so a Standard build cannot
 * spend Premium-sized model time on copy.
 */
export function assertTextPipelineAccess(row: ProspectIntakeRow): string | null {
  if (row.status === 'archived') return 'This intake link is no longer active.'
  return null
}

/** Copy/enhancer passes a tier may spend. Cost ceiling in place of a paywall. */
export function textPassBudget(row: ProspectIntakeRow): number {
  return effectiveIntakeTier(row) === 'ai_premium' ? 10 : 5
}

export function assertDraftIntake(row: ProspectIntakeRow): string | null {
  if (row.status === 'archived') return 'This intake link is no longer active.'
  if (row.status !== 'draft') return 'This intake has already been submitted.'
  return null
}

export function tierSlug(row: ProspectIntakeRow): IntakeTierSlug {
  return effectiveIntakeTier(row)
}

/**
 * Persist AI Premium tier when payment records show a premium deposit but the
 * row was downgraded. Returns the healed row (or the original if no change).
 */
export async function healIntakeTierFromPayments(
  row: ProspectIntakeRow
): Promise<ProspectIntakeRow> {
  if (row.intake_tier === 'ai_premium') return row
  if (!hasPaidPremiumDeposit(row)) return row

  const entry = getTierEntry('ai_premium')
  if (!entry) return row

  const depositStatus = depositStatusForTier(
    'ai_premium',
    row.deposit_paid_cents,
    entry.depositCents
  )
  const patch = {
    intake_tier: 'ai_premium' as const,
    tier_total_cents: entry.totalCents,
    deposit_required_cents: entry.depositCents,
    deposit_status: depositStatus,
    tier_selected_at: row.tier_selected_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const admin = getSupabaseAdmin()
  await admin.from('prospect_intakes').update(patch).eq('id', row.id)

  return { ...row, ...patch }
}
