import { OTHER_SERVICE_LABEL } from '@/lib/catalog/contractorServices'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'

/** Service labels used for product slots, image studio, and provision (excludes sentinel Other checkbox). */
export function provisionServiceLabels(row: {
  services?: string[] | null
  other_services?: string | null
}): string[] {
  const base = (row.services ?? []).filter((s) => s !== OTHER_SERVICE_LABEL)
  const other = row.other_services?.trim()
  if (other) return [...base, other]
  return base.length > 0 ? base : ['Walk-In Closets']
}

export function provisionServiceLabelsFromForm(services: string[], otherServices: string): string[] {
  return provisionServiceLabels({
    services,
    other_services: otherServices,
  } as ProspectIntakeRow)
}
