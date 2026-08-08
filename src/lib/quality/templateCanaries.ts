export type TemplateCanaryCandidate = {
  tenantId: string
  hostname: string
  engagementModel: string
  isPrimary: boolean
  source: string
}

const MODEL_ORDER = ['quote', 'order', 'booking', 'ticket']

/** Pick one public engine site per engagement model, then fill remaining slots. */
export function selectTemplateCanaries(
  candidates: TemplateCanaryCandidate[],
  limit = 3
): Array<{ url: string; engagementModel: string }> {
  const byTenant = new Map<string, TemplateCanaryCandidate>()
  for (const candidate of candidates) {
    const hostname = candidate.hostname.trim().toLowerCase()
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(hostname)) continue
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) continue
    const normalized = { ...candidate, hostname }
    const current = byTenant.get(candidate.tenantId)
    const score = Number(normalized.isPrimary) * 2 + Number(normalized.source === 'platform_subdomain')
    const currentScore = current ? Number(current.isPrimary) * 2 + Number(current.source === 'platform_subdomain') : -1
    if (!current || score > currentScore) byTenant.set(candidate.tenantId, normalized)
  }

  const pool = [...byTenant.values()].sort((a, b) => a.hostname.localeCompare(b.hostname))
  const selected: TemplateCanaryCandidate[] = []
  for (const model of MODEL_ORDER) {
    const match = pool.find((candidate) => candidate.engagementModel === model)
    if (match && selected.length < limit) selected.push(match)
  }
  for (const candidate of pool) {
    if (selected.length >= limit) break
    if (!selected.includes(candidate)) selected.push(candidate)
  }
  return selected.map(({ hostname, engagementModel }) => ({
    url: `https://${hostname}`,
    engagementModel,
  }))
}
