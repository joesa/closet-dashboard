import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { attachVercelDomain, normalizeDomain } from '@/lib/vercel-domains'
import {
  allowedTlds,
  domainPurchaseEnabled,
  getPlatformRegistrant,
  maxPurchaseCents,
  mergeAttachIntoDomainPatch,
  parseSearchLabel,
  suggestDomainsFromSlug,
  type DomainRow,
} from '@/lib/domains/types'
import {
  buyDomain,
  checkDomainAvailability,
  getDomainNameservers,
  getDomainPrice,
} from '@/lib/domains/vercelRegistrar'
import { listDomainsForTenant } from '@/lib/domains/auth'

export type DomainSearchHit = {
  domain: string
  available: boolean
  priceUsd: number | null
  priceCents: number | null
  error?: string
}

export async function searchDomainsForLabel(opts: {
  query: string
  slugHint?: string
}): Promise<{ suggestions: DomainSearchHit[]; purchaseEnabled: boolean }> {
  const purchaseEnabled = domainPurchaseEnabled()
  const label = parseSearchLabel(opts.query) || parseSearchLabel(opts.slugHint || '')
  if (!label) {
    return { suggestions: [], purchaseEnabled }
  }

  const candidates = new Set<string>()
  // If user typed a full domain with allowed TLD, check that first.
  const full = normalizeDomain(opts.query)
  if (full) {
    const tld = full.split('.').pop() || ''
    if (allowedTlds().includes(tld)) candidates.add(full)
  }
  for (const d of suggestDomainsFromSlug(label)) candidates.add(d)

  const suggestions: DomainSearchHit[] = []
  for (const domain of candidates) {
    const [avail, price] = await Promise.all([
      checkDomainAvailability(domain),
      getDomainPrice(domain),
    ])
    const priceUsd = price.price
    suggestions.push({
      domain,
      available: avail.available,
      priceUsd,
      priceCents: priceUsd != null ? Math.round(priceUsd * 100) : null,
      error: avail.error || price.error,
    })
  }

  return { suggestions, purchaseEnabled }
}

export type PurchaseResult = {
  domain: DomainRow
  orderId?: string
  wholesaleCents: number
  nameservers: string[]
}

/**
 * Platform buys the domain via Vercel Registrar, attaches it to the websites
 * project, and records wholesale cost for maintenance fold-in.
 */
export async function purchaseDomainForTenant(opts: {
  tenantId: string
  domainInput: string
}): Promise<PurchaseResult> {
  if (!domainPurchaseEnabled()) {
    throw new Error('Domain purchase is not enabled on this environment.')
  }

  const hostname = normalizeDomain(opts.domainInput)
  if (!hostname) throw new Error('Enter a valid domain (e.g. example.com)')

  const tld = hostname.split('.').pop() || ''
  if (!allowedTlds().includes(tld)) {
    throw new Error(`Only these TLDs can be purchased: ${allowedTlds().map((t) => `.${t}`).join(', ')}`)
  }

  const registrant = getPlatformRegistrant()
  if (!registrant) {
    throw new Error(
      'Platform registrant contact is not configured (DOMAIN_REGISTRANT_* env vars).'
    )
  }

  const admin = getSupabaseAdmin()
  const existing = await listDomainsForTenant(opts.tenantId)
  if (existing.some((d) => d.hostname === hostname)) {
    throw new Error('This domain is already connected to your site.')
  }

  const { data: taken } = await admin
    .from('domains')
    .select('id, tenant_id')
    .eq('hostname', hostname)
    .maybeSingle()
  if (taken) throw new Error('This domain is already connected to another site.')

  const avail = await checkDomainAvailability(hostname)
  if (!avail.attempted) {
    throw new Error(avail.error || 'Vercel API is not configured for domain purchase.')
  }
  if (!avail.available) {
    throw new Error(avail.error || 'That domain is not available.')
  }

  const price = await getDomainPrice(hostname)
  if (price.price == null) {
    throw new Error(price.error || 'Could not retrieve domain pricing.')
  }

  const wholesaleCents = Math.round(price.price * 100)
  if (wholesaleCents > maxPurchaseCents()) {
    throw new Error(
      `Domain price ($${(wholesaleCents / 100).toFixed(2)}) exceeds the platform purchase cap ($${(maxPurchaseCents() / 100).toFixed(2)}). Contact support.`
    )
  }

  const buy = await buyDomain({
    domain: hostname,
    expectedPrice: price.price,
    years: 1,
    autoRenew: true,
    contactInformation: {
      firstName: registrant.firstName,
      lastName: registrant.lastName,
      email: registrant.email,
      phone: registrant.phone,
      address1: registrant.address1,
      address2: registrant.address2,
      city: registrant.city,
      state: registrant.state,
      zip: registrant.zip,
      country: registrant.country,
      companyName: registrant.companyName,
    },
  })

  if (!buy.ok) {
    throw new Error(buy.error || 'Domain purchase failed')
  }

  // Attach to websites project (Vercel NS domains usually verify quickly).
  const vercel = await attachVercelDomain(hostname)
  const patch = mergeAttachIntoDomainPatch(vercel)
  const ns = await getDomainNameservers(hostname)

  await admin.from('domains').update({ is_primary: false }).eq('tenant_id', opts.tenantId)

  const purchasedAt = new Date()
  const expiresAt = new Date(purchasedAt)
  expiresAt.setFullYear(expiresAt.getFullYear() + 1)

  const { data, error } = await admin
    .from('domains')
    .insert({
      tenant_id: opts.tenantId,
      hostname,
      source: 'purchased',
      is_primary: true,
      ...patch,
      registrar_order_id: buy.orderId || null,
      purchase_price_cents: wholesaleCents,
      purchase_currency: 'usd',
      purchased_at: purchasedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      auto_renew: true,
      nameservers: ns.nameservers.length > 0 ? ns.nameservers : null,
      last_checked_at: purchasedAt.toISOString(),
      status_message: patch.status_message || 'Purchased — configuring DNS',
    })
    .select(
      'id, tenant_id, hostname, is_primary, ssl_status, source, vercel_verified, verification_records, nameservers, registrar_order_id, purchase_price_cents, purchase_currency, purchased_at, expires_at, auto_renew, last_checked_at, status_message, created_at'
    )
    .single()

  if (error) throw error

  return {
    domain: data as DomainRow,
    orderId: buy.orderId,
    wholesaleCents,
    nameservers: ns.nameservers,
  }
}
