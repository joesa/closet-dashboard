import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { attachVercelDomain, normalizeDomain } from '@/lib/vercel-domains'
import {
  instructionsFromVerification,
  mergeAttachIntoDomainPatch,
  type DomainRow,
  type DnsInstruction,
} from '@/lib/domains/types'
import { getProjectDomainStatus } from '@/lib/domains/vercelRegistrar'
import { getDomainForTenant, listDomainsForTenant, makeDomainPrimary } from '@/lib/domains/auth'

export type AttachByoResult = {
  domain: DomainRow
  dnsInstructions: DnsInstruction[]
  vercel: Awaited<ReturnType<typeof attachVercelDomain>>
}

/**
 * Attach a bring-your-own domain to the tenant: insert domains row, attach to
 * Vercel project, return DNS instructions for the customer's registrar.
 */
export async function attachByoDomain(opts: {
  tenantId: string
  hostnameInput: string
  makePrimary?: boolean
}): Promise<AttachByoResult> {
  const hostname = normalizeDomain(opts.hostnameInput)
  if (!hostname) {
    throw new Error('Enter a valid domain (e.g. example.com)')
  }

  const admin = getSupabaseAdmin()
  const existing = await listDomainsForTenant(opts.tenantId)
  const already = existing.find((d) => d.hostname === hostname)
  if (already && already.source === 'platform_subdomain') {
    throw new Error('That hostname is the platform subdomain and cannot be re-attached as BYO.')
  }

  // Global uniqueness — domains.hostname is UNIQUE across tenants.
  const { data: taken } = await admin
    .from('domains')
    .select('id, tenant_id')
    .eq('hostname', hostname)
    .maybeSingle()

  if (taken && taken.tenant_id !== opts.tenantId) {
    throw new Error('This domain is already connected to another site.')
  }

  const makePrimary = opts.makePrimary !== false
  if (makePrimary) {
    await admin.from('domains').update({ is_primary: false }).eq('tenant_id', opts.tenantId)
  }

  const vercel = await attachVercelDomain(hostname)
  const patch = mergeAttachIntoDomainPatch(vercel)

  let domain: DomainRow
  if (already) {
    const { data, error } = await admin
      .from('domains')
      .update({
        source: 'byo',
        is_primary: makePrimary || already.is_primary,
        ...patch,
        last_checked_at: new Date().toISOString(),
      })
      .eq('id', already.id)
      .select(
        'id, tenant_id, hostname, is_primary, ssl_status, source, vercel_verified, verification_records, nameservers, registrar_order_id, purchase_price_cents, purchase_currency, purchased_at, expires_at, auto_renew, last_checked_at, status_message, created_at'
      )
      .single()
    if (error) throw error
    domain = data as DomainRow
  } else {
    const { data, error } = await admin
      .from('domains')
      .insert({
        tenant_id: opts.tenantId,
        hostname,
        source: 'byo',
        is_primary: makePrimary,
        ...patch,
        last_checked_at: new Date().toISOString(),
      })
      .select(
        'id, tenant_id, hostname, is_primary, ssl_status, source, vercel_verified, verification_records, nameservers, registrar_order_id, purchase_price_cents, purchase_currency, purchased_at, expires_at, auto_renew, last_checked_at, status_message, created_at'
      )
      .single()
    if (error) throw error
    domain = data as DomainRow
  }

  const dnsInstructions = instructionsFromVerification(domain.verification_records, hostname)
  return { domain, dnsInstructions, vercel }
}

export type CheckDomainResult = {
  domain: DomainRow
  dnsInstructions: DnsInstruction[]
  verified: boolean
}

/** Refresh verification status from Vercel and update the domains row. */
export async function checkDomainVerification(
  tenantId: string,
  domainId: string
): Promise<CheckDomainResult> {
  const existing = await getDomainForTenant(domainId, tenantId)
  if (!existing) throw new Error('Domain not found')

  if (existing.source === 'platform_subdomain') {
    return {
      domain: existing,
      dnsInstructions: [],
      verified: existing.ssl_status === 'active',
    }
  }

  const status = await getProjectDomainStatus(existing.hostname)
  const admin = getSupabaseAdmin()
  const now = new Date().toISOString()

  let vercel_verified = existing.vercel_verified
  let ssl_status = existing.ssl_status
  let verification_records = existing.verification_records
  let status_message = existing.status_message

  if (!status.attempted) {
    status_message = status.error || 'Vercel not configured'
  } else if (!status.ok) {
    // Domain may not be attached yet — try re-attach once.
    const attach = await attachVercelDomain(existing.hostname)
    const patch = mergeAttachIntoDomainPatch(attach)
    vercel_verified = patch.vercel_verified
    ssl_status = patch.ssl_status
    verification_records = patch.verification_records
    status_message = patch.status_message
  } else {
    vercel_verified = status.verified === true
    ssl_status = vercel_verified ? 'active' : 'pending'
    if (status.verification != null) verification_records = status.verification
    status_message = vercel_verified ? 'Verified' : 'Awaiting DNS verification'
  }

  const { data, error } = await admin
    .from('domains')
    .update({
      vercel_verified,
      ssl_status,
      verification_records,
      status_message,
      last_checked_at: now,
    })
    .eq('id', domainId)
    .eq('tenant_id', tenantId)
    .select(
      'id, tenant_id, hostname, is_primary, ssl_status, source, vercel_verified, verification_records, nameservers, registrar_order_id, purchase_price_cents, purchase_currency, purchased_at, expires_at, auto_renew, last_checked_at, status_message, created_at'
    )
    .single()

  if (error) throw error
  const domain = data as DomainRow

  return {
    domain,
    dnsInstructions: instructionsFromVerification(domain.verification_records, domain.hostname),
    verified: domain.vercel_verified,
  }
}

/** Cron: poll all pending non-platform domains. */
export async function pollPendingDomains(limit = 40): Promise<{
  checked: number
  activated: number
  errors: string[]
}> {
  const admin = getSupabaseAdmin()
  const { data: pending, error } = await admin
    .from('domains')
    .select('id, tenant_id')
    .eq('ssl_status', 'pending')
    .neq('source', 'platform_subdomain')
    .order('last_checked_at', { ascending: true, nullsFirst: true })
    .limit(limit)

  if (error) throw error

  let activated = 0
  const errors: string[] = []
  for (const row of pending || []) {
    try {
      const result = await checkDomainVerification(row.tenant_id, row.id)
      if (result.verified) activated += 1
    } catch (e) {
      errors.push(`${row.id}: ${e instanceof Error ? e.message : 'check failed'}`)
    }
  }

  return { checked: (pending || []).length, activated, errors }
}

export { makeDomainPrimary }
