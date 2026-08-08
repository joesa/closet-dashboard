export const MAX_FULL_REDESIGN_BATCH_SIZE = 20

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function normalizeFullRedesignTenantIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set<string>(
    value.filter((id: unknown): id is string => typeof id === 'string' && UUID_PATTERN.test(id))
  ))
}