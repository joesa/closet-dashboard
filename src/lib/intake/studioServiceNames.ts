import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'
import { provisionServiceLabels } from '@/lib/intake/provisionServiceLabels'

const MAX_SERVICE_SLOTS = 24
const MAX_LABEL_LENGTH = 120

/**
 * Resolve the ordered service labels used for AI image-studio product slots.
 *
 * The image studio runs while the intake is still a draft, so `row.services`
 * may not yet reflect the contractor's current form selections. The client
 * therefore sends the same labels it renders (derived via
 * `provisionServiceLabelsFromForm`). We sanitize that list and fall back to the
 * row-derived labels when the client doesn't provide a usable one. Product
 * slots are keyed by service name, so this keeps client indices and server
 * slots aligned and consistent with provisioning at submit time.
 */
export function resolveStudioServiceNames(
  row: ProspectIntakeRow,
  rawServiceNames: unknown
): string[] {
  if (Array.isArray(rawServiceNames)) {
    const cleaned = rawServiceNames
      .filter((s): s is string => typeof s === 'string')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length <= MAX_LABEL_LENGTH)
      .slice(0, MAX_SERVICE_SLOTS)
    if (cleaned.length > 0) return cleaned
  }
  return provisionServiceLabels(row)
}
