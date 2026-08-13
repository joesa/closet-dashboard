/** Normalize a service label for duplicate detection without changing display copy. */
export function serviceOfferingKey(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\bservices?\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function includesServiceOffering(existing: string[], candidate: string): boolean {
  const candidateKey = serviceOfferingKey(candidate)
  if (!candidateKey) return true
  return existing.some((value) => serviceOfferingKey(value) === candidateKey)
}

export function splitServiceOfferings(value: string | null | undefined): string[] {
  return (value || '')
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}
