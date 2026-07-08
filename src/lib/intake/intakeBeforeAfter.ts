import { resolveIndustrySlug } from '@/lib/catalog/serviceCatalog'
import { findCustomIndustryByLabel } from '@/lib/catalog/customIndustries'
import {
  getBeforeAfterCategory,
  type BeforeAfterCategory,
} from '@/lib/images/beforeAfterPrompt'

/**
 * Resolve the before/after subject category for an intake, mirroring
 * provisioning's applicability logic: an explicit contractor-created custom
 * industry record wins, otherwise the static catalog classification for the
 * resolved industry slug. `'not-applicable'` means the business has no
 * physical "before" state (restaurants, legal, medical, booking/ticketed…)
 * and the transformation slider — and its image generation — should be
 * skipped entirely.
 */
export async function resolveIntakeBeforeAfterCategory(row: {
  industry?: string | null
  services?: string[] | null
  other_services?: string | null
}): Promise<BeforeAfterCategory> {
  if (row.industry?.trim()) {
    const custom = await findCustomIndustryByLabel(row.industry).catch(() => null)
    if (custom) return custom.beforeAfterCategory
  }
  const slug = resolveIndustrySlug({
    industry: row.industry ?? undefined,
    services: row.services ?? undefined,
    other_services: row.other_services ?? undefined,
  })
  return getBeforeAfterCategory(slug)
}
