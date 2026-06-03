import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'
import { isLaunchBuildPaid } from '@/lib/intake/intakePaymentStage'
import type { IntakeCheckoutKind } from '@/lib/intake/intakePaymentStage'

export type TenantSiteStatus =
  | 'pending_approval'
  | 'awaiting_launch_payment'
  | 'active'
  | 'suspended'
  | 'widget_only'

function dashboardOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.closetquotes.com').replace(
    /\/$/,
    ''
  )
}

function launchCheckoutKind(row: ProspectIntakeRow): IntakeCheckoutKind {
  return row.intake_tier === 'ai_premium' ? 'balance' : 'standard_build'
}

/** Resolve public site_status + pay link from intake payment state. */
export function resolveLaunchAccess(row: ProspectIntakeRow): {
  siteStatus: TenantSiteStatus
  launchPayUrl: string | null
} {
  if (isLaunchBuildPaid(row)) {
    return { siteStatus: 'active', launchPayUrl: null }
  }

  const payKind = launchCheckoutKind(row)
  const launchPayUrl = `${dashboardOrigin()}/intake/${row.token}?pay=${payKind}`

  if (row.preview_approved_at) {
    return { siteStatus: 'awaiting_launch_payment', launchPayUrl }
  }

  return { siteStatus: 'pending_approval', launchPayUrl: null }
}

/**
 * Keep tenant site_status in sync with intake launch payment.
 * Prevents custom domains and subdomains from serving the full site before pay-to-launch.
 */
export async function syncTenantLaunchAccess(opts: {
  tenantId: string
  intakeId?: string | null
}): Promise<{ siteStatus: TenantSiteStatus; launchPayUrl: string | null }> {
  const admin = getSupabaseAdmin()

  let intake: ProspectIntakeRow | null = null

  if (opts.intakeId) {
    const { data } = await admin
      .from('prospect_intakes')
      .select(
        'id, token, intake_tier, build_paid_at, balance_paid_at, preview_approved_at, provisioned_contractor_id'
      )
      .eq('id', opts.intakeId)
      .maybeSingle()
    intake = data as ProspectIntakeRow | null
  } else {
    const { data } = await admin
      .from('prospect_intakes')
      .select(
        'id, token, intake_tier, build_paid_at, balance_paid_at, preview_approved_at, provisioned_contractor_id'
      )
      .eq('provisioned_contractor_id', opts.tenantId)
      .maybeSingle()
    intake = data as ProspectIntakeRow | null
  }

  if (!intake?.token) {
    return { siteStatus: 'pending_approval', launchPayUrl: null }
  }

  const { siteStatus, launchPayUrl } = resolveLaunchAccess(intake)

  const { error: tenantErr } = await admin
    .from('tenants')
    .update({ site_status: siteStatus, updated_at: new Date().toISOString() })
    .eq('id', opts.tenantId)

  if (tenantErr) throw tenantErr

  const { error: configErr } = await admin
    .from('site_configs')
    .update({
      launch_pay_url: launchPayUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', opts.tenantId)

  if (configErr) throw configErr

  return { siteStatus, launchPayUrl }
}
