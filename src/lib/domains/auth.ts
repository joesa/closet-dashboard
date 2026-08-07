import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getSupabaseServer } from '@/lib/supabase-server'
import { getCurrentAdmin } from '@/lib/admin'
import { headers } from 'next/headers'
import type { DomainRow } from '@/lib/domains/types'

export type DomainActor =
  | { role: 'admin'; adminId: string; email: string | null }
  | { role: 'contractor'; userId: string; email: string | null; tenantId: string }

type OwnedTenant = {
  id: string
  widget_id: string | null
  site_status: string | null
}

type OwnedDomain = {
  tenant_id: string
  hostname: string
}

export function chooseOwnedTenantId(
  settingsIdsNewestFirst: string[],
  tenants: OwnedTenant[],
  domains: OwnedDomain[],
  preferredHostname?: string | null
): string | null {
  const hosted = tenants.filter((tenant) => tenant.site_status !== 'widget_only')
  if (preferredHostname) {
    const normalized = preferredHostname.toLowerCase()
    const matchingDomain = domains.find(
      (domain) => domain.hostname.toLowerCase() === normalized
    )
    if (matchingDomain && hosted.some((tenant) => tenant.id === matchingDomain.tenant_id)) {
      return matchingDomain.tenant_id
    }
  }

  // Preserve the previous newest-profile preference, but continue through all
  // profiles until an actually hosted tenant is found.
  for (const settingsId of settingsIdsNewestFirst) {
    const tenant = hosted.find((candidate) => candidate.widget_id === settingsId)
    if (tenant) return tenant.id
  }
  return hosted[0]?.id ?? null
}

function hostnameFromHeader(value: string | null): string | null {
  const first = value?.split(',')[0]?.trim()
  if (!first) return null
  try {
    return new URL(`http://${first}`).hostname.toLowerCase()
  } catch {
    return first.split(':')[0]?.toLowerCase() || null
  }
}

async function currentTenantHostname(): Promise<string | null> {
  try {
    const requestHeaders = await headers()
    return hostnameFromHeader(
      requestHeaders.get('x-tenant-host') ||
      requestHeaders.get('x-forwarded-host') ||
      requestHeaders.get('host')
    )
  } catch {
    return null
  }
}

/**
 * Resolve any hosted tenant owned by the signed-in contractor. Multi-site
 * accounts can have several contractor_settings rows, so the current tenant
 * hostname wins and the newest hosted profile is the fallback.
 */
export async function resolveContractorTenantId(
  userId: string,
  preferredHostname?: string | null
): Promise<string | null> {
  const admin = getSupabaseAdmin()
  const { data: settingsRows } = await admin
    .from('contractor_settings')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  const settingsIds = (settingsRows || []).map((settings) => settings.id).filter(Boolean)
  if (settingsIds.length === 0) return null

  const { data: tenants } = await admin
    .from('tenants')
    .select('id, widget_id, site_status')
    .in('widget_id', settingsIds)

  const hostedTenantIds = (tenants || [])
    .filter((tenant) => tenant.site_status !== 'widget_only')
    .map((tenant) => tenant.id)
  let domains: OwnedDomain[] = []
  if (preferredHostname && hostedTenantIds.length > 0) {
    const { data } = await admin
      .from('domains')
      .select('tenant_id, hostname')
      .in('tenant_id', hostedTenantIds)
    domains = (data || []) as OwnedDomain[]
  }

  return chooseOwnedTenantId(
    settingsIds,
    (tenants || []) as OwnedTenant[],
    domains,
    preferredHostname
  )
}

/**
 * Auth for domain APIs.
 * - With tenantId + admin: admin override for that tenant
 * - Without tenantId (or non-admin): contractor scoped to their own site
 */
export async function resolveDomainActor(opts?: {
  tenantId?: string | null
}): Promise<{ actor: DomainActor; tenantId: string } | { error: string; status: number }> {
  const tenantIdParam = opts?.tenantId?.trim() || null
  const adminUser = await getCurrentAdmin()

  // Explicit admin override when tenantId is provided by an admin.
  if (adminUser && tenantIdParam) {
    return {
      actor: {
        role: 'admin',
        adminId: adminUser.id,
        email: adminUser.email,
      },
      tenantId: tenantIdParam,
    }
  }

  const supabase = await getSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized', status: 401 }
  }

  const preferredHostname = tenantIdParam ? null : await currentTenantHostname()
  const tenantId = await resolveContractorTenantId(user.id, preferredHostname)
  if (tenantId) {
    if (tenantIdParam && tenantIdParam !== tenantId && !adminUser) {
      return { error: 'Forbidden', status: 403 }
    }
    // Prefer contractor scope when they own a site (even if also admin).
    if (!tenantIdParam || tenantIdParam === tenantId) {
      return {
        actor: {
          role: 'contractor',
          userId: user.id,
          email: user.email ?? null,
          tenantId,
        },
        tenantId,
      }
    }
  }

  if (adminUser && tenantIdParam) {
    return {
      actor: { role: 'admin', adminId: adminUser.id, email: adminUser.email },
      tenantId: tenantIdParam,
    }
  }

  if (adminUser && !tenantIdParam) {
    return { error: 'tenantId is required for admin domain actions', status: 400 }
  }

  return {
    error:
      'No hosted website found for this account. Domains are available after a full site is provisioned.',
    status: 404,
  }
}

export function actorTenantId(
  resolved: { actor: DomainActor; tenantId: string }
): string {
  return resolved.tenantId
}

export async function listDomainsForTenant(tenantId: string): Promise<DomainRow[]> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('domains')
    .select(
      'id, tenant_id, hostname, is_primary, ssl_status, source, vercel_verified, verification_records, nameservers, registrar_order_id, purchase_price_cents, purchase_currency, purchased_at, expires_at, auto_renew, last_checked_at, status_message, created_at'
    )
    .eq('tenant_id', tenantId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data || []) as DomainRow[]
}

export async function getDomainForTenant(
  domainId: string,
  tenantId: string
): Promise<DomainRow | null> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('domains')
    .select(
      'id, tenant_id, hostname, is_primary, ssl_status, source, vercel_verified, verification_records, nameservers, registrar_order_id, purchase_price_cents, purchase_currency, purchased_at, expires_at, auto_renew, last_checked_at, status_message, created_at'
    )
    .eq('id', domainId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) throw error
  return data as DomainRow | null
}

/** Demote other primaries, then set this hostname primary. */
export async function makeDomainPrimary(tenantId: string, domainId: string): Promise<DomainRow> {
  const admin = getSupabaseAdmin()
  const existing = await getDomainForTenant(domainId, tenantId)
  if (!existing) throw new Error('Domain not found')

  await admin.from('domains').update({ is_primary: false }).eq('tenant_id', tenantId)
  const { data, error } = await admin
    .from('domains')
    .update({ is_primary: true })
    .eq('id', domainId)
    .eq('tenant_id', tenantId)
    .select(
      'id, tenant_id, hostname, is_primary, ssl_status, source, vercel_verified, verification_records, nameservers, registrar_order_id, purchase_price_cents, purchase_currency, purchased_at, expires_at, auto_renew, last_checked_at, status_message, created_at'
    )
    .single()

  if (error) throw error
  return data as DomainRow
}
