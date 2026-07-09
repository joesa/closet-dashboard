import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getSupabaseServer } from '@/lib/supabase-server'
import { getCurrentAdmin } from '@/lib/admin'
import type { DomainRow } from '@/lib/domains/types'

export type DomainActor =
  | { role: 'admin'; adminId: string; email: string | null }
  | { role: 'contractor'; userId: string; email: string | null; tenantId: string }

/**
 * Resolve the signed-in contractor's hosted tenant via widget_id linkage.
 * Returns null when the user has no full site (widget-only / not provisioned).
 */
export async function resolveContractorTenantId(userId: string): Promise<string | null> {
  const admin = getSupabaseAdmin()
  const { data: settings } = await admin
    .from('contractor_settings')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!settings) return null

  const { data: tenant } = await admin
    .from('tenants')
    .select('id')
    .eq('widget_id', settings.id)
    .neq('site_status', 'widget_only')
    .maybeSingle()

  return tenant?.id ?? null
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

  const tenantId = await resolveContractorTenantId(user.id)
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
