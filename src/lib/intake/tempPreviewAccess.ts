import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'
import { resolveLaunchAccess, type TenantSiteStatus } from '@/lib/intake/syncTenantLaunchAccess'
import { canEnqueueBackgroundJobs, enqueueJob } from '@/lib/jobs/enqueueJob'
import { TASK_TEMP_PREVIEW_REVERT } from '@/lib/jobs/taskIds'
import { revalidateTenantSiteCache } from '@/lib/tenants/revalidateTenantSite'

/** Preset durations offered in the admin "Temporary Approve" form. */
export const TEMP_PREVIEW_DURATIONS: readonly { hours: number; label: string }[] = [
  { hours: 1, label: '1 hour' },
  { hours: 4, label: '4 hours' },
  { hours: 12, label: '12 hours' },
  { hours: 24, label: '24 hours (1 day)' },
  { hours: 72, label: '3 days' },
  { hours: 168, label: '7 days' },
]

/**
 * Whether a granted temp-preview window is still open.
 *
 * Deliberately a module-level helper rather than an inline comparison: the
 * admin intake page is a dynamic Server Component that renders once per
 * request, so reading the clock there is correct, but `react-hooks/purity`
 * rejects a bare `Date.now()` in a component body. Keeping the comparison here
 * also gives the page and the revert worker one definition to agree on.
 */
export function isTempPreviewActive(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false
  return new Date(expiresAt).getTime() > Date.now()
}

const INTAKE_COLUMNS =
  'id, token, intake_tier, build_paid_at, balance_paid_at, preview_approved_at, provisioned_contractor_id'

async function loadIntakeForLaunchAccess(opts: {
  tenantId: string
  intakeId?: string
}): Promise<ProspectIntakeRow | null> {
  const admin = getSupabaseAdmin()
  if (opts.intakeId) {
    const { data } = await admin
      .from('prospect_intakes')
      .select(INTAKE_COLUMNS)
      .eq('id', opts.intakeId)
      .maybeSingle()
    return data as ProspectIntakeRow | null
  }
  const { data } = await admin
    .from('prospect_intakes')
    .select(INTAKE_COLUMNS)
    .eq('provisioned_contractor_id', opts.tenantId)
    .maybeSingle()
  return data as ProspectIntakeRow | null
}

/**
 * Grant a temporary, self-expiring preview. The public site evaluates this
 * timestamp on every request, so access closes at the deadline even if the
 * cleanup worker is delayed. The worker clears the override and restores the
 * canonical payment state after expiry.
 */
export async function grantTempPreview(opts: {
  tenantId: string
  intakeId: string
  hours: number
}): Promise<{ expiresAt: string }> {
  if (!Number.isFinite(opts.hours) || opts.hours <= 0) {
    throw new Error('hours must be a positive number')
  }
  if (!canEnqueueBackgroundJobs()) {
    throw new Error(
      'DATABASE_URL is not configured — cannot schedule the auto-revert job. Temporary preview requires the Graphile Worker to be reachable.'
    )
  }

  const admin = getSupabaseAdmin()
  const expiresAt = new Date(Date.now() + opts.hours * 60 * 60 * 1000).toISOString()

  // jobKeyMode 'replace' collapses a re-grant (extend/shorten) into one job —
  // re-clicking "Temporary Approve" with a new duration reschedules cleanly.
  // Schedule first: if Graphile is unreachable, no access override is written.
  await enqueueJob(
    TASK_TEMP_PREVIEW_REVERT,
    { tenantId: opts.tenantId },
    {
      jobKey: `temp_preview_revert:${opts.tenantId}`,
      jobKeyMode: 'replace',
      runAt: new Date(expiresAt),
      maxAttempts: 5,
    }
  )

  const { error: tenantErr } = await admin
    .from('tenants')
    .update({
      temp_preview_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', opts.tenantId)
  if (tenantErr) throw tenantErr

  await revalidateTenantSiteCache(opts.tenantId)

  return { expiresAt }
}

/**
 * Revert a temp-preview-active tenant back to its real payment-gated status
 * right now, regardless of the scheduled expiry. Shared by the admin
 * "Require payment now" button and the auto-revert worker job so both paths
 * compute the same answer the same way.
 *
 * Recomputes from live intake payment state rather than assuming "unpaid" —
 * if the balance was actually paid while temp preview was active, this
 * correctly leaves (or puts) the site active for real.
 */
export async function revertTempPreviewNow(opts: {
  tenantId: string
  intakeId?: string
}): Promise<{ siteStatus: TenantSiteStatus; launchPayUrl: string | null; reverted: boolean }> {
  const admin = getSupabaseAdmin()
  const { data: tenant } = await admin
    .from('tenants')
    .select('temp_preview_expires_at, site_status')
    .eq('id', opts.tenantId)
    .maybeSingle()

  if (!tenant?.temp_preview_expires_at) {
    // Nothing to revert — already reverted, or temp preview was never granted.
    return {
      siteStatus: (tenant?.site_status as TenantSiteStatus) || 'pending_approval',
      launchPayUrl: null,
      reverted: false,
    }
  }

  const intake = await loadIntakeForLaunchAccess(opts)
  if (!intake?.token) {
    // Can't resolve real payment state for this tenant — fail safe by gating
    // it, never by silently leaving a payment-bypassed site open.
    const siteStatus: TenantSiteStatus = 'awaiting_launch_payment'
    await admin
      .from('tenants')
      .update({ site_status: siteStatus, temp_preview_expires_at: null, updated_at: new Date().toISOString() })
      .eq('id', opts.tenantId)
    await revalidateTenantSiteCache(opts.tenantId)
    return { siteStatus, launchPayUrl: null, reverted: true }
  }

  const resolved = resolveLaunchAccess(intake)

  const { error: tenantErr } = await admin
    .from('tenants')
    .update({
      site_status: resolved.siteStatus,
      temp_preview_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', opts.tenantId)
  if (tenantErr) throw tenantErr

  const { error: configErr } = await admin
    .from('site_configs')
    .update({ launch_pay_url: resolved.launchPayUrl, updated_at: new Date().toISOString() })
    .eq('tenant_id', opts.tenantId)
  if (configErr) throw configErr

  await revalidateTenantSiteCache(opts.tenantId)

  return { ...resolved, reverted: true }
}

/**
 * Worker-side entry point: only reverts once the granted window has actually
 * elapsed. A no-op when the admin already disabled it manually (column is
 * null) or extended it (jobKeyMode 'replace' rescheduled this job to a later
 * runAt, but if an old invocation somehow still fires, the fresh expiry read
 * here is still in the future and this defensively declines to act).
 */
export async function revertTempPreviewIfDue(tenantId: string): Promise<{ reverted: boolean }> {
  const admin = getSupabaseAdmin()
  const { data: tenant } = await admin
    .from('tenants')
    .select('temp_preview_expires_at')
    .eq('id', tenantId)
    .maybeSingle()

  if (!tenant?.temp_preview_expires_at) return { reverted: false }
  if (isTempPreviewActive(tenant.temp_preview_expires_at)) return { reverted: false }

  const result = await revertTempPreviewNow({ tenantId })
  return { reverted: result.reverted }
}
