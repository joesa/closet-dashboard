/**
 * Vercel Domains Registrar API + project domain status helpers.
 * Project attach remains in @/lib/vercel-domains (attachVercelDomain).
 */

export type RegistrarAvailability = {
  available: boolean
  attempted: boolean
  error?: string
}

export type RegistrarPrice = {
  /** Wholesale price in USD (dollars, not cents) from Vercel. */
  price: number | null
  years?: number
  attempted: boolean
  error?: string
  raw?: unknown
}

export type RegistrarBuyResult = {
  ok: boolean
  attempted: boolean
  orderId?: string
  error?: string
  status?: number
  raw?: unknown
}

export type RegistrarOrderStatus = 'draft' | 'purchasing' | 'completed' | 'failed' | string

export type RegistrarOrderResult = {
  ok: boolean
  attempted: boolean
  orderId?: string
  status?: RegistrarOrderStatus
  domainStatuses?: Array<{ domainName?: string; status?: string; price?: number }>
  error?: string
  errorCode?: string
  raw?: unknown
}

export type ProjectDomainStatus = {
  attempted: boolean
  ok: boolean
  verified?: boolean
  verification?: unknown
  error?: string
  status?: number
  name?: string
}

function vercelAuth(): { token: string; teamId?: string } | null {
  const token = process.env.VERCEL_API_TOKEN
  if (!token) return null
  return { token, teamId: process.env.VERCEL_TEAM_ID || undefined }
}

function withTeam(url: URL, teamId?: string) {
  if (teamId) url.searchParams.set('teamId', teamId)
  return url
}

async function vercelJson(
  url: URL,
  init: RequestInit & { token: string }
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      Authorization: `Bearer ${init.token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
  const data: unknown = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

/** GET /v1/registrar/domains/{domain}/availability */
export async function checkDomainAvailability(domain: string): Promise<RegistrarAvailability> {
  const auth = vercelAuth()
  if (!auth) return { available: false, attempted: false, error: 'VERCEL_API_TOKEN not set' }

  try {
    const url = withTeam(
      new URL(`https://api.vercel.com/v1/registrar/domains/${encodeURIComponent(domain)}/availability`),
      auth.teamId
    )
    const { ok, data } = await vercelJson(url, { method: 'GET', token: auth.token })
    if (!ok) {
      const message = (data as { error?: { message?: string }; message?: string })?.error?.message
        || (data as { message?: string })?.message
        || 'Availability check failed'
      return { available: false, attempted: true, error: message }
    }
    return {
      available: (data as { available?: boolean }).available === true,
      attempted: true,
    }
  } catch (e) {
    return {
      available: false,
      attempted: true,
      error: e instanceof Error ? e.message : 'Availability check failed',
    }
  }
}

/**
 * GET /v1/registrar/domains/{domain}/price
 * Response shapes vary; we accept price / purchasePrice / years.
 */
export async function getDomainPrice(domain: string): Promise<RegistrarPrice> {
  const auth = vercelAuth()
  if (!auth) return { price: null, attempted: false, error: 'VERCEL_API_TOKEN not set' }

  try {
    const url = withTeam(
      new URL(`https://api.vercel.com/v1/registrar/domains/${encodeURIComponent(domain)}/price`),
      auth.teamId
    )
    const { ok, data } = await vercelJson(url, { method: 'GET', token: auth.token })
    if (!ok) {
      const message = (data as { error?: { message?: string } })?.error?.message || 'Price lookup failed'
      return { price: null, attempted: true, error: message, raw: data }
    }

    const d = data as Record<string, unknown>
    const priceRaw =
      typeof d.price === 'number'
        ? d.price
        : typeof d.purchasePrice === 'number'
          ? d.purchasePrice
          : typeof (d.periodYears as { price?: number } | undefined)?.price === 'number'
            ? (d.periodYears as { price: number }).price
            : null

    return {
      price: priceRaw,
      years: typeof d.years === 'number' ? d.years : 1,
      attempted: true,
      raw: data,
    }
  } catch (e) {
    return {
      price: null,
      attempted: true,
      error: e instanceof Error ? e.message : 'Price lookup failed',
    }
  }
}

export type BuyDomainInput = {
  domain: string
  expectedPrice: number
  years?: number
  autoRenew?: boolean
  contactInformation: {
    firstName: string
    lastName: string
    email: string
    phone: string
    address1: string
    address2?: string
    city: string
    state: string
    zip: string
    country: string
    companyName?: string
  }
}

/** POST /v1/registrar/domains/{domain}/buy */
export async function buyDomain(input: BuyDomainInput): Promise<RegistrarBuyResult> {
  const auth = vercelAuth()
  if (!auth) return { ok: false, attempted: false, error: 'VERCEL_API_TOKEN not set' }

  try {
    const url = withTeam(
      new URL(`https://api.vercel.com/v1/registrar/domains/${encodeURIComponent(input.domain)}/buy`),
      auth.teamId
    )
    const { ok, status, data } = await vercelJson(url, {
      method: 'POST',
      token: auth.token,
      body: JSON.stringify({
        autoRenew: input.autoRenew !== false,
        years: input.years ?? 1,
        expectedPrice: input.expectedPrice,
        contactInformation: input.contactInformation,
      }),
    })

    if (!ok) {
      const message =
        (data as { error?: { message?: string }; message?: string })?.error?.message
        || (data as { message?: string })?.message
        || `HTTP ${status}`
      return { ok: false, attempted: true, status, error: message }
    }

    const orderId = (data as { orderId?: string }).orderId
    if (!orderId) {
      return {
        ok: false,
        attempted: true,
        status,
        error: 'Buy succeeded but Vercel did not return an orderId',
        raw: data,
      }
    }

    return {
      ok: true,
      attempted: true,
      status,
      orderId,
      raw: data,
    }
  } catch (e) {
    return {
      ok: false,
      attempted: true,
      error: e instanceof Error ? e.message : 'Purchase failed',
    }
  }
}

/**
 * GET /v1/registrar/orders/{orderId}
 * Docs: https://vercel.com/docs/rest-api/domains-registrar/get-a-domain-order
 */
export async function getRegistrarOrder(orderId: string): Promise<RegistrarOrderResult> {
  const auth = vercelAuth()
  if (!auth) return { ok: false, attempted: false, error: 'VERCEL_API_TOKEN not set' }

  try {
    const url = withTeam(
      new URL(`https://api.vercel.com/v1/registrar/orders/${encodeURIComponent(orderId)}`),
      auth.teamId
    )
    const { ok, data } = await vercelJson(url, { method: 'GET', token: auth.token })
    if (!ok) {
      return {
        ok: false,
        attempted: true,
        orderId,
        error: (data as { error?: { message?: string }; message?: string })?.error?.message
          || (data as { message?: string })?.message
          || 'Order lookup failed',
        raw: data,
      }
    }

    const payload = data as {
      orderId?: string
      status?: string
      domains?: Array<{ domainName?: string; status?: string; price?: number }>
      error?: { code?: string; message?: string }
    }

    return {
      ok: true,
      attempted: true,
      orderId: payload.orderId || orderId,
      status: payload.status,
      domainStatuses: Array.isArray(payload.domains) ? payload.domains : undefined,
      errorCode: payload.error?.code,
      error: payload.error?.message || payload.error?.code,
      raw: data,
    }
  } catch (e) {
    return {
      ok: false,
      attempted: true,
      orderId,
      error: e instanceof Error ? e.message : 'Order lookup failed',
    }
  }
}

/** Poll registrar order until completed/failed or timeout. */
export async function waitForRegistrarOrder(
  orderId: string,
  opts?: { timeoutMs?: number; intervalMs?: number }
): Promise<RegistrarOrderResult> {
  const timeoutMs = opts?.timeoutMs ?? 45_000
  const intervalMs = opts?.intervalMs ?? 2_000
  const started = Date.now()
  let last: RegistrarOrderResult = { ok: false, attempted: false, orderId }

  while (Date.now() - started < timeoutMs) {
    last = await getRegistrarOrder(orderId)
    if (!last.ok && last.attempted === false) return last
    if (last.ok && (last.status === 'completed' || last.status === 'failed')) {
      return last
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }

  return {
    ...last,
    ok: false,
    error:
      last.status === 'purchasing' || last.status === 'draft'
        ? `Domain order still ${last.status} after ${Math.round(timeoutMs / 1000)}s — check Vercel Domains / billing`
        : last.error || 'Timed out waiting for domain order completion',
  }
}

/** GET /v1/registrar/domains/{domain} — ownership record when registered. */
export async function getRegistrarDomain(
  domain: string
): Promise<{ ok: boolean; attempted: boolean; owned: boolean; raw?: unknown; error?: string }> {
  const auth = vercelAuth()
  if (!auth) return { ok: false, attempted: false, owned: false, error: 'VERCEL_API_TOKEN not set' }

  try {
    const url = withTeam(
      new URL(`https://api.vercel.com/v1/registrar/domains/${encodeURIComponent(domain)}`),
      auth.teamId
    )
    const { ok, status, data } = await vercelJson(url, { method: 'GET', token: auth.token })
    if (status === 404) {
      return { ok: true, attempted: true, owned: false, raw: data }
    }
    if (!ok) {
      return {
        ok: false,
        attempted: true,
        owned: false,
        error: (data as { error?: { message?: string } })?.error?.message || 'Domain lookup failed',
        raw: data,
      }
    }
    return { ok: true, attempted: true, owned: true, raw: data }
  } catch (e) {
    return {
      ok: false,
      attempted: true,
      owned: false,
      error: e instanceof Error ? e.message : 'Domain lookup failed',
    }
  }
}

/** GET /v9/projects/{id}/domains/{domain} — verification status for an attached domain. */
export async function getProjectDomainStatus(hostname: string): Promise<ProjectDomainStatus> {
  const auth = vercelAuth()
  const projectId = process.env.VERCEL_WEBSITES_PROJECT_ID
  if (!auth || !projectId) {
    return {
      attempted: false,
      ok: false,
      error: 'VERCEL_API_TOKEN or VERCEL_WEBSITES_PROJECT_ID not set',
    }
  }

  try {
    const url = withTeam(
      new URL(
        `https://api.vercel.com/v9/projects/${projectId}/domains/${encodeURIComponent(hostname)}`
      ),
      auth.teamId
    )
    const { ok, status, data } = await vercelJson(url, { method: 'GET', token: auth.token })
    if (!ok) {
      return {
        attempted: true,
        ok: false,
        status,
        error: (data as { error?: { message?: string } })?.error?.message || `HTTP ${status}`,
      }
    }

    const d = data as {
      name?: string
      verified?: boolean
      verification?: unknown
    }
    return {
      attempted: true,
      ok: true,
      status,
      name: d.name,
      verified: d.verified === true,
      verification: d.verification,
    }
  } catch (e) {
    return {
      attempted: true,
      ok: false,
      error: e instanceof Error ? e.message : 'Domain status check failed',
    }
  }
}

/**
 * Best-effort: fetch nameservers for a registrar-managed domain.
 * Endpoint may vary; failures are non-fatal.
 */
export async function getDomainNameservers(
  domain: string
): Promise<{ attempted: boolean; nameservers: string[]; error?: string }> {
  const auth = vercelAuth()
  if (!auth) return { attempted: false, nameservers: [], error: 'VERCEL_API_TOKEN not set' }

  try {
    const url = withTeam(
      new URL(`https://api.vercel.com/v1/registrar/domains/${encodeURIComponent(domain)}`),
      auth.teamId
    )
    const { ok, data } = await vercelJson(url, { method: 'GET', token: auth.token })
    if (!ok) {
      return {
        attempted: true,
        nameservers: [],
        error: (data as { error?: { message?: string } })?.error?.message || 'Nameserver lookup failed',
      }
    }
    const d = data as { nameservers?: string[]; ns?: string[] }
    const nameservers = Array.isArray(d.nameservers)
      ? d.nameservers
      : Array.isArray(d.ns)
        ? d.ns
        : []
    return { attempted: true, nameservers }
  } catch (e) {
    return {
      attempted: true,
      nameservers: [],
      error: e instanceof Error ? e.message : 'Nameserver lookup failed',
    }
  }
}
