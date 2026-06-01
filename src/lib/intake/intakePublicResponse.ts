import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'
import { canUseImageStudio } from '@/lib/intake/intakeTierGates'
import { parseImageSelections } from '@/lib/intake/imageSelections'
import { getTierCatalog, getTierEntry, formatUsd } from '@/lib/intake/tiers'

export function buildIntakePublicJson(row: ProspectIntakeRow) {
  const tierEntry = getTierEntry(
    row.intake_tier === 'ai_premium' ? 'ai_premium' : 'standard'
  )
  const selections = parseImageSelections(row.image_selections)
  const aiRaw = row.ai_site_config as Record<string, unknown> | null
  const siteConfig = aiRaw?.siteConfig ?? aiRaw

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
    tierLabel: tierEntry?.label,
    depositDisplay: formatUsd(row.deposit_required_cents),
    totalDisplay: formatUsd(row.tier_total_cents),
    remainderDisplay: formatUsd(
      Math.max(0, row.tier_total_cents - row.deposit_required_cents)
    ),
    canUseImageStudio: canUseImageStudio(row),
    tierCatalog: getTierCatalog(),
    aiSiteConfig: siteConfig ?? null,
    imageSelections: selections,
  }
}
