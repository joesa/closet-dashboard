import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { ProvisionReviewError } from '@/lib/provision/types'

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export async function assertNoDuplicateProvision(opts: {
  businessName: string
  ownerEmail: string
  contactPhone?: string | null
  existingTenantId?: string | null
}) {
  const admin = getSupabaseAdmin()
  const email = opts.ownerEmail.trim().toLowerCase()
  if (!email) throw new Error('Owner email required')

  const { data: tenantByEmail } = await admin
    .from('tenants')
    .select('id')
    .eq('owner_email', email)
    .maybeSingle()
  if (tenantByEmail && tenantByEmail.id !== opts.existingTenantId) {
    throw new ProvisionReviewError('A tenant already exists for this owner email')
  }

  const norm = normalizeName(opts.businessName)
  if (norm.length < 2) return

  const { data: tenants } = await admin
    .from('tenants')
    .select('id, business_name, owner_email')
    .ilike('business_name', `%${opts.businessName.slice(0, 20)}%`)
    .limit(20)

  for (const t of tenants ?? []) {
    if (normalizeName(t.business_name || '') === norm && t.owner_email?.toLowerCase() === email) {
      throw new ProvisionReviewError('Duplicate business name and email')
    }
  }
}
