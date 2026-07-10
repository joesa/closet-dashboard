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
  getRegistrarDomain,
  waitForRegistrarOrder,
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

function requireWebsitesProjectConfigured() {
  if (!process.env.VERCEL_API_TOKEN?.trim()) {
    throw new Error('VERCEL_API_TOKEN is not configured.')
  }
  if (!process.env.VERCEL_WEBSITES_PROJECT_ID?.trim()) {
    throw new Error(
      'VERCEL_WEBSITES_PROJECT_ID is not configured — cannot attach purchased domains to the sites project.'
    )
  }
}

/**
 * Platform buys the domain via Vercel Registrar, attaches it to the websites
 * project, and records wholesale cost for maintenance fold-in.
 *
 * Only marks source=purchased after the registrar order reaches status
 * "completed" (or the domain ownership record exists). Failed/pending orders
 * never write a purchased row.
 */
export async function purchaseDomainForTenant(opts: {
  tenantId: string
  domainInput: string
}): Promise<PurchaseResult> {
  if (!domainPurchaseEnabled()) {
    throw new Error('Domain purchase is not enabled on this environment.')
  }
  requireWebsitesProjectConfigured()

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
  const sameTenantRow = existing.find((d) => d.hostname === hostname)
  if (sameTenantRow?.source === 'purchased' && sameTenantRow.registrar_order_id) {
    // Verify the prior order actually completed; allow retry on failed/stale markers.
    const prior = await waitForRegistrarOrder(sameTenantRow.registrar_order_id, {
      timeoutMs: 5_000,
      intervalMs: 1_000,
    })
    if (prior.ok && prior.status === 'completed') {
      throw new Error('This domain is already purchased for your site.')
    }
    console.warn(
      `[domains] clearing failed/stale purchase marker for ${hostname} (order ${sameTenantRow.registrar_order_id} status=${prior.status || prior.error})`
    )
  } else if (sameTenantRow?.source === 'purchased') {
    console.warn(`[domains] clearing purchased marker without order id for ${hostname}`)
  }
  if (sameTenantRow?.source === 'platform_subdomain') {
    throw new Error('That hostname is the platform subdomain and cannot be purchased.')
  }
  // source === 'byo' (or any other non-purchased row): upgrade in place after buy.
  // Older provision paths inserted desired_domain as byo before purchase.

  const { data: taken } = await admin
    .from('domains')
    .select('id, tenant_id')
    .eq('hostname', hostname)
    .maybeSingle()
  if (taken && taken.tenant_id !== opts.tenantId) {
    throw new Error('This domain is already connected to another site.')
  }

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

  if (!buy.ok || !buy.orderId) {
    throw new Error(buy.error || 'Domain purchase failed')
  }

  const order = await waitForRegistrarOrder(buy.orderId)
  if (!order.ok || order.status !== 'completed') {
    const code = order.errorCode || order.status || 'unknown'
    const detail = order.error || order.status || 'not completed'
    throw new Error(
      `Vercel domain order ${buy.orderId} did not complete (${code}: ${detail}). ` +
        'Fix billing/payment method in Vercel Domains, then retry purchase. ' +
        'No purchased domain was recorded.'
    )
  }

  // Confirm the domain is no longer available to buy (ownership settled).
  const stillAvail = await checkDomainAvailability(hostname)
  if (stillAvail.attempted && stillAvail.available) {
    throw new Error(
      `Order ${buy.orderId} reported completed but ${hostname} is still listed as available. ` +
        'Check Vercel Domains / billing before retrying. No purchased domain was recorded.'
    )
  }

  // Best-effort ownership record (non-fatal if the inventory endpoint lags).
  const owned = await getRegistrarDomain(hostname)
  if (owned.attempted && owned.ok && !owned.owned) {
    console.warn(
      `[domains] order ${buy.orderId} completed but registrar domain record for ${hostname} not found yet`
    )
  }

  // Attach to websites project (Vercel NS domains usually verify quickly).
  const vercel = await attachVercelDomain(hostname)
  const patch = mergeAttachIntoDomainPatch(vercel)
  const ns = await getDomainNameservers(hostname)

  await admin.from('domains').update({ is_primary: false }).eq('tenant_id', opts.tenantId)

  const purchasedAt = new Date()
  const expiresAt = new Date(purchasedAt)
  expiresAt.setFullYear(expiresAt.getFullYear() + 1)

  const purchasedFields = {
    source: 'purchased' as const,
    is_primary: true,
    ...patch,
    registrar_order_id: buy.orderId,
    purchase_price_cents: wholesaleCents,
    purchase_currency: 'usd',
    purchased_at: purchasedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    auto_renew: true,
    nameservers: ns.nameservers.length > 0 ? ns.nameservers : null,
    last_checked_at: purchasedAt.toISOString(),
    status_message: patch.status_message || 'Purchased — configuring DNS',
  }

  const selectCols =
    'id, tenant_id, hostname, is_primary, ssl_status, source, vercel_verified, verification_records, nameservers, registrar_order_id, purchase_price_cents, purchase_currency, purchased_at, expires_at, auto_renew, last_checked_at, status_message, created_at'

  let data: DomainRow
  if (sameTenantRow) {
    const { data: updated, error } = await admin
      .from('domains')
      .update(purchasedFields)
      .eq('id', sameTenantRow.id)
      .select(selectCols)
      .single()
    if (error) throw error
    data = updated as DomainRow
  } else {
    const { data: inserted, error } = await admin
      .from('domains')
      .insert({
        tenant_id: opts.tenantId,
        hostname,
        ...purchasedFields,
      })
      .select(selectCols)
      .single()
    if (error) throw error
    data = inserted as DomainRow
  }

  return {
    domain: data,
    orderId: buy.orderId,
    wholesaleCents,
    nameservers: ns.nameservers,
  }
}
