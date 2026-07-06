import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'
import { canUseImageStudio } from '@/lib/intake/intakeTierGates'
import { parseImageSelections } from '@/lib/intake/imageSelections'
import {
  getTierCatalog,
  getTierEntry,
  getSiteMaintenancePricing,
  formatUsd,
} from '@/lib/intake/tiers'
import {
  getIntakePaymentSummary,
  isLaunchBuildPaid,
} from '@/lib/intake/intakePaymentStage'

export function buildIntakePublicJson(row: ProspectIntakeRow) {
  const tierEntry = getTierEntry(
    row.intake_tier === 'ai_premium' ? 'ai_premium' : 'standard'
  )
  const selections = parseImageSelections(row.image_selections)
  const aiRaw = row.ai_site_config as Record<string, unknown> | null
  const siteConfig = aiRaw?.siteConfig ?? aiRaw
  const payment = getIntakePaymentSummary(row)
  const widgetConfigHints =
    row.widget_config_hints && typeof row.widget_config_hints === 'object'
      ? ({ ...row.widget_config_hints } as Record<string, unknown>)
      : {}
  if (row.industry && !widgetConfigHints.industry) {
    widgetConfigHints.industry = row.industry
  }

  return {
    businessName: row.business_name,
    status: row.status,
    alreadySubmitted: row.status !== 'draft',
    source: row.source,
    emailVerified: !!row.email_verified_at,
    requestedProduct: row.requested_product,
    provisioningMode: row.provisioning_mode,
    intakeTier: row.intake_tier,
    tierTotalCents: row.tier_total_cents,
    depositRequiredCents: row.deposit_required_cents,
    depositPaidCents: row.deposit_paid_cents,
    depositStatus: row.deposit_status,
    // True once the contractor has already made an explicit Standard vs AI
    // Premium choice before reaching the form (get-started flow, or a
    // tier-specific email link) — used to hide the redundant TierPicker.
    tierSelected: !!row.tier_selected_at,
    tierLabel: tierEntry?.label,
    depositDisplay: formatUsd(row.deposit_required_cents),
    totalDisplay: formatUsd(row.tier_total_cents),
    remainderCents: Math.max(0, row.tier_total_cents - row.deposit_required_cents),
    remainderDisplay: formatUsd(
      Math.max(0, row.tier_total_cents - row.deposit_required_cents)
    ),
    canUseImageStudio: canUseImageStudio(row),
    tierCatalog: getTierCatalog(),
    siteMaintenance: getSiteMaintenancePricing(),
    aiSiteConfig: siteConfig ?? null,
    widgetConfigHints: Object.keys(widgetConfigHints).length > 0 ? widgetConfigHints : null,
    imageSelections: selections,
    maintenancePlan: row.maintenance_plan,
    previewApprovedAt: row.preview_approved_at,
    siteLiveAt: row.site_live_at,
    buildPaidAt: row.build_paid_at,
    balancePaidAt: row.balance_paid_at,
    maintenanceStartedAt: row.maintenance_started_at,
    paymentStage: payment.stage,
    paymentDueLabel: payment.label,
    paymentCheckoutKind: payment.checkoutKind,
    canPayToLaunch: payment.canCheckout,
    launchPaid: isLaunchBuildPaid(row),
  }
}
