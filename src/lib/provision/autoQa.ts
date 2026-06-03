import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { isLaunchBuildPaid } from '@/lib/intake/intakePaymentStage'

export type AutoQaResult = { passed: boolean; reasons: string[] }

export function runAutoQaChecks(opts: {
  businessName: string
  contactEmail: string | null
  services: string[] | null
  subdomain: string
}): AutoQaResult {
  const reasons: string[] = []
  if (!opts.businessName?.trim()) reasons.push('missing business name')
  if (!opts.contactEmail?.trim()) reasons.push('missing contact email')
  if (!opts.services?.length) reasons.push('no services')
  if (!opts.subdomain?.trim()) reasons.push('missing subdomain')
  return { passed: reasons.length === 0, reasons }
}

export async function maybeAutoApproveTenant(tenantId: string, qa: AutoQaResult) {
  if (process.env.AUTO_APPROVE_PROVISION_JOBS !== 'true') return
  if (!qa.passed) return

  const admin = getSupabaseAdmin()
  const { data: intake } = await admin
    .from('prospect_intakes')
    .select('intake_tier, build_paid_at, balance_paid_at')
    .eq('provisioned_contractor_id', tenantId)
    .maybeSingle()

  if (intake && !isLaunchBuildPaid(intake)) return

  await admin
    .from('tenants')
    .update({ site_status: 'active' })
    .eq('id', tenantId)
    .eq('site_status', 'pending_approval')
}
