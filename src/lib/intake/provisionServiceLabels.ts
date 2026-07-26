import { OTHER_SERVICE_LABEL } from '@/lib/catalog/contractorServices'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'

/** Split free-text / comma-joined other_services into individual labels. */
export function parseOtherServices(text: string | null | undefined): string[] {
  if (!text || !text.trim()) return []
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Service labels used for product slots, image studio, and provision (excludes sentinel Other checkbox). */
export function provisionServiceLabels(row: {
  services?: string[] | null
  other_services?: string | null
}): string[] {
  const base = (row.services ?? []).filter((s) => s !== OTHER_SERVICE_LABEL)
  const fromOther = parseOtherServices(row.other_services)
  const seen = new Set<string>()
  const out: string[] = []
  for (const label of [...base, ...fromOther]) {
    const key = label.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(label)
  }
  return out.length > 0 ? out : ['Walk-In Closets']
}

export function provisionServiceLabelsFromForm(services: string[], otherServices: string): string[] {
  return provisionServiceLabels({
    services,
    other_services: otherServices,
  } as ProspectIntakeRow)
}
