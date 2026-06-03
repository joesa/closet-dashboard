import { getTenantPublicUrl } from '@/lib/admin-preview'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'
import { isLaunchBuildPaid } from '@/lib/intake/intakePaymentStage'

function dashboardOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.closetquotes.com').replace(
    /\/$/,
    ''
  )
}

/** Public tenant site URL + contractor dashboard login for post-launch redirects. */
export async function resolveIntakeLaunchUrls(row: ProspectIntakeRow): Promise<{
  launchPaid: boolean
  tenantSiteUrl: string | null
  loginUrl: string
}> {
  const loginUrl = `${dashboardOrigin()}/login`
  const launchPaid = isLaunchBuildPaid(row)

  if (!row.provisioned_contractor_id) {
    return { launchPaid, tenantSiteUrl: null, loginUrl }
  }

  const admin = getSupabaseAdmin()
  const { data: domain } = await admin
    .from('domains')
    .select('hostname')
    .eq('tenant_id', row.provisioned_contractor_id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  const tenantSiteUrl = domain?.hostname
    ? getTenantPublicUrl(domain.hostname)
    : null

  return {
    launchPaid,
    tenantSiteUrl: tenantSiteUrl && tenantSiteUrl !== '#' ? tenantSiteUrl : null,
    loginUrl,
  }
}
