import { normalizeDomain, type VercelDomainResult } from '@/lib/vercel-domains'

export type DomainSource = 'platform_subdomain' | 'byo' | 'purchased'

export type DomainRow = {
  id: string
  tenant_id: string
  hostname: string
  is_primary: boolean
  ssl_status: string
  source: DomainSource
  vercel_verified: boolean
  verification_records: unknown | null
  nameservers: string[] | null
  registrar_order_id: string | null
  purchase_price_cents: number | null
  purchase_currency: string
  purchased_at: string | null
  expires_at: string | null
  auto_renew: boolean | null
  last_checked_at: string | null
  status_message: string | null
  created_at?: string
}

export type DnsInstruction = {
  type: string
  name: string
  value: string
  reason: string
}

/** Default BYO DNS when Vercel doesn't return verification records. */
export function defaultByoDnsInstructions(hostname: string): DnsInstruction[] {
  return [
    {
      type: 'A',
      name: '@',
      value: '76.76.21.21',
      reason: `Point the apex (${hostname}) at Vercel`,
    },
    {
      type: 'CNAME',
      name: 'www',
      value: 'cname.vercel-dns.com',
      reason: `Point www.${hostname} at Vercel`,
    },
  ]
}

export function instructionsFromVerification(verification: unknown, hostname: string): DnsInstruction[] {
  if (!Array.isArray(verification) || verification.length === 0) {
    return defaultByoDnsInstructions(hostname)
  }

  const out: DnsInstruction[] = []
  for (const item of verification) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const type = typeof rec.type === 'string' ? rec.type.toUpperCase() : 'TXT'
    const domain = typeof rec.domain === 'string' ? rec.domain : hostname
    const value =
      typeof rec.value === 'string'
        ? rec.value
        : typeof rec.txt === 'string'
          ? rec.txt
          : ''
    if (!value) continue
    out.push({
      type,
      name: domain === hostname ? '@' : domain.replace(`.${hostname}`, ''),
      value,
      reason: typeof rec.reason === 'string' ? rec.reason : 'Required by Vercel for domain verification',
    })
  }

  return out.length > 0 ? out : defaultByoDnsInstructions(hostname)
}

export function allowedTlds(): string[] {
  const raw = process.env.DOMAIN_ALLOWED_TLDS || 'com,net,io'
  return raw
    .split(',')
    .map((t) => t.trim().toLowerCase().replace(/^\./, ''))
    .filter(Boolean)
}

export function domainPurchaseEnabled(): boolean {
  return process.env.DOMAIN_PURCHASE_ENABLED === 'true' || process.env.DOMAIN_PURCHASE_ENABLED === '1'
}

export function maxPurchaseCents(): number {
  const n = Number(process.env.DOMAIN_MAX_PURCHASE_CENTS || '5000')
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 5000
}

export function suggestDomainsFromSlug(slug: string): string[] {
  const base = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  if (!base) return []
  return allowedTlds().map((tld) => `${base}.${tld}`)
}

export function parseSearchLabel(input: string): string | null {
  const trimmed = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  if (!trimmed) return null
  // Full domain already
  const asDomain = normalizeDomain(trimmed)
  if (asDomain) return asDomain.split('.')[0] || null
  // Bare label
  const label = trimmed.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
  return label || null
}

export type PlatformRegistrant = {
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

export function getPlatformRegistrant(): PlatformRegistrant | null {
  const firstName = process.env.DOMAIN_REGISTRANT_FIRST_NAME?.trim()
  const lastName = process.env.DOMAIN_REGISTRANT_LAST_NAME?.trim()
  const email = process.env.DOMAIN_REGISTRANT_EMAIL?.trim()
  const phone = process.env.DOMAIN_REGISTRANT_PHONE?.trim()
  const address1 = process.env.DOMAIN_REGISTRANT_ADDRESS1?.trim()
  const city = process.env.DOMAIN_REGISTRANT_CITY?.trim()
  const state = process.env.DOMAIN_REGISTRANT_STATE?.trim()
  const zip = process.env.DOMAIN_REGISTRANT_ZIP?.trim()
  const country = process.env.DOMAIN_REGISTRANT_COUNTRY?.trim()
  if (!firstName || !lastName || !email || !phone || !address1 || !city || !state || !zip || !country) {
    return null
  }
  return {
    firstName,
    lastName,
    email,
    phone,
    address1,
    address2: process.env.DOMAIN_REGISTRANT_ADDRESS2?.trim() || undefined,
    city,
    state,
    zip,
    country,
    companyName: process.env.DOMAIN_REGISTRANT_COMPANY?.trim() || undefined,
  }
}

export function formatUsdCents(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

export function mergeAttachIntoDomainPatch(attach: VercelDomainResult): {
  vercel_verified: boolean
  verification_records: unknown | null
  ssl_status: string
  status_message: string | null
} {
  if (!attach.attempted) {
    return {
      vercel_verified: false,
      verification_records: null,
      ssl_status: 'pending',
      status_message: attach.error || 'Vercel attach skipped (env not configured)',
    }
  }
  if (!attach.ok) {
    return {
      vercel_verified: false,
      verification_records: null,
      ssl_status: 'pending',
      status_message: attach.error || 'Vercel attach failed',
    }
  }
  const verified = attach.verified === true
  return {
    vercel_verified: verified,
    verification_records: attach.verification ?? null,
    ssl_status: verified ? 'active' : 'pending',
    status_message: verified
      ? 'Verified'
      : attach.note === 'already_attached'
        ? 'Attached — awaiting DNS verification'
        : 'Attached — awaiting DNS verification',
  }
}
