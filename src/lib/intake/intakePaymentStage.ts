import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'
import { formatUsd, getTierEntry } from '@/lib/intake/tiers'

export type IntakeCheckoutKind = 'deposit' | 'balance' | 'standard_build' | 'maintenance'

export type PaymentDueStage =
  | 'draft'
  | 'deposit'
  | 'awaiting_preview'
  | 'standard_build'
  | 'balance'
  | 'maintenance'
  | 'complete'

export type IntakePaymentSummary = {
  stage: PaymentDueStage
  label: string
  checkoutKind: IntakeCheckoutKind | null
  amountCents: number
  canCheckout: boolean
}

/** Standard build paid in full, or AI Premium balance paid (launch). */
export function isLaunchBuildPaid(row: ProspectIntakeRow): boolean {
  if (row.intake_tier === 'standard') return !!row.build_paid_at
  return !!row.balance_paid_at
}

function buildPaid(row: ProspectIntakeRow): boolean {
  return isLaunchBuildPaid(row)
}

export function getIntakePaymentSummary(row: ProspectIntakeRow): IntakePaymentSummary {
  const tier = getTierEntry(row.intake_tier === 'ai_premium' ? 'ai_premium' : 'standard')
  const total = row.tier_total_cents || tier?.totalCents || 0
  const remainder = Math.max(0, total - row.deposit_required_cents)

  if (row.status === 'draft') {
    if (
      row.intake_tier === 'ai_premium' &&
      row.deposit_required_cents > 0 &&
      row.deposit_status !== 'paid'
    ) {
      return {
        stage: 'deposit',
        label: `Deposit due (${formatUsd(row.deposit_required_cents)})`,
        checkoutKind: 'deposit',
        amountCents: row.deposit_required_cents,
        canCheckout: true,
      }
    }
    return {
      stage: 'draft',
      label: 'Draft — intake in progress',
      checkoutKind: null,
      amountCents: 0,
      canCheckout: false,
    }
  }

  if (!row.preview_approved_at) {
    return {
      stage: 'awaiting_preview',
      label: 'Awaiting preview approval',
      checkoutKind: null,
      amountCents: 0,
      canCheckout: false,
    }
  }

  if (row.intake_tier === 'standard' && !row.build_paid_at) {
    return {
      stage: 'standard_build',
      label: `Build payment due (${formatUsd(total)})`,
      checkoutKind: 'standard_build',
      amountCents: total,
      canCheckout: true,
    }
  }

  if (row.intake_tier === 'ai_premium' && !row.balance_paid_at) {
    if (row.deposit_status !== 'paid') {
      return {
        stage: 'deposit',
        label: `Deposit required before balance (${formatUsd(row.deposit_required_cents)})`,
        checkoutKind: 'deposit',
        amountCents: row.deposit_required_cents,
        canCheckout: row.deposit_required_cents > 0,
      }
    }
    return {
      stage: 'balance',
      label: `Balance due (${formatUsd(remainder)})`,
      checkoutKind: 'balance',
      amountCents: remainder,
      canCheckout: remainder > 0,
    }
  }

  if (
    row.site_live_at &&
    row.maintenance_plan &&
    !row.maintenance_started_at &&
    row.provisioned_contractor_id
  ) {
    return {
      stage: 'maintenance',
      label: `Site maintenance (${row.maintenance_plan})`,
      checkoutKind: 'maintenance',
      amountCents: 0,
      canCheckout: true,
    }
  }

  if (buildPaid(row) && !row.maintenance_plan) {
    return {
      stage: 'complete',
      label: 'Launch payment complete',
      checkoutKind: null,
      amountCents: 0,
      canCheckout: false,
    }
  }

  if (buildPaid(row) && row.maintenance_started_at) {
    return {
      stage: 'complete',
      label: 'Paid — maintenance active',
      checkoutKind: null,
      amountCents: 0,
      canCheckout: false,
    }
  }

  if (buildPaid(row) && !row.site_live_at) {
    return {
      stage: 'complete',
      label: 'Build paid — awaiting site live for maintenance',
      checkoutKind: null,
      amountCents: 0,
      canCheckout: false,
    }
  }

  return {
    stage: 'complete',
    label: 'No payment due',
    checkoutKind: null,
    amountCents: 0,
    canCheckout: false,
  }
}

export function assertCheckoutAllowed(
  row: ProspectIntakeRow,
  kind: IntakeCheckoutKind
): string | null {
  const summary = getIntakePaymentSummary(row)
  if (summary.checkoutKind !== kind) {
    return `Checkout not available for ${kind} at this stage (${summary.label}).`
  }
  return null
}
