import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'
import type { IntakeTierSlug } from '@/lib/intake/tiers'

export function depositSatisfied(row: ProspectIntakeRow): boolean {
  if (row.deposit_required_cents <= 0) return true
  return row.deposit_status === 'paid'
}

export function canUseImageStudio(row: ProspectIntakeRow): boolean {
  return row.intake_tier === 'ai_premium' && depositSatisfied(row)
}

export function assertDepositPaid(row: ProspectIntakeRow): string | null {
  if (row.intake_tier !== 'ai_premium') {
    return 'AI image studio is only available on the AI Premium tier.'
  }
  if (!depositSatisfied(row)) {
    return 'Pay the 30% deposit to unlock AI image generation.'
  }
  return null
}

export function assertDraftIntake(row: ProspectIntakeRow): string | null {
  if (row.status === 'archived') return 'This intake link is no longer active.'
  if (row.status !== 'draft') return 'This intake has already been submitted.'
  return null
}

export function tierSlug(row: ProspectIntakeRow): IntakeTierSlug {
  return row.intake_tier === 'ai_premium' ? 'ai_premium' : 'standard'
}
