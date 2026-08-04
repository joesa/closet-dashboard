import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { logSystemAction } from '@/lib/admin'
import {
  getCustomBuildJob,
  isCustomBuildJobActive,
  setCustomBuildJob,
  type CustomBuildJob,
} from '@/lib/ai/customBuildJob'
import { enqueueFullRedesign } from '@/lib/jobs/enqueueFullRedesign'
import { canEnqueueBackgroundJobs } from '@/lib/jobs/enqueueJob'
import { publishCustomSiteDraft } from '@/lib/ai/generateCustomSite'
import { syncTenantLaunchAccess } from '@/lib/intake/syncTenantLaunchAccess'
import { getIntakePaymentSummary } from '@/lib/intake/intakePaymentStage'
import { sendIntakeLaunchPaymentEmail } from '@/lib/intake/sendIntakeLaunchEmail'
import { revalidateTenantSiteCache } from '@/lib/tenants/revalidateTenantSite'
import { publicAppOrigin } from '@/lib/urls'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'

/**
 * Auto-launch — a submitted intake becomes a live, bespoke site with no admin click.
 *
 * Sequence, all unattended:
 *   provisionFromIntakeJob → deploy + validate engine site
 *                          → waitForInitialSiteDeployed() (it actually serves)
 *                          → autoApproveTenantSite()      (live on the template)
 *                          → startAutoLaunchRedesign()
 *   full_redesign worker   → re-verify admin-bypass preview, then redesign
 *                          → finishAutoLaunch()           (publish draft in place)
 *                          → failAutoLaunch()             (dead-lettered: stay on template)
 *
 * Deploy-and-approve first, redesign second. The customer is live on the engine
 * template within minutes of submitting, and the redesign upgrades that live
 * site in place when it lands. The trade-off is deliberate: the public may see
 * the template for the length of one redesign, which beats a customer who paid
 * and can see nothing at all.
 *
 * What this does NOT do: bypass any quality or payment gate. The publish gate
 * (validateCustomSiteArtifact + design-uniqueness), the site-validation gate
 * (tenants.validation_status) and the launch-payment gate
 * (syncTenantLaunchAccess) all still apply exactly as they do for an admin.
 */

/** Kill switch — set AUTO_LAUNCH_REDESIGN=false to restore the manual flow. */
function autoLaunchEnabled(): boolean {
  return process.env.AUTO_LAUNCH_REDESIGN !== 'false'
}

/**
 * Because we reveal *after* the redesign, a redesign that exhausts its Graphile
 * attempts would otherwise leave a paying customer permanently invisible. By
 * default we still reveal, on the engine template, and log for follow-up.
 * Set AUTO_LAUNCH_REVEAL_ON_REDESIGN_FAILURE=false to keep it gated instead.
 */
function revealOnRedesignFailure(): boolean {
  return process.env.AUTO_LAUNCH_REVEAL_ON_REDESIGN_FAILURE !== 'false'
}

type AutoLaunchRow = {
  auto_launch_redesign_at: string | null
  /** Site taken live without an admin — set before the redesign is queued. */
  auto_launch_approved_at: string | null
  /** Post-redesign publish ran — the end of the unattended sequence. */
  auto_launch_completed_at: string | null
  edit_in_place: boolean | null
}

async function loadAutoLaunchRow(tenantId: string): Promise<AutoLaunchRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('site_configs')
    .select(
      'auto_launch_redesign_at, auto_launch_approved_at, auto_launch_completed_at, edit_in_place'
    )
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (error || !data) return null
  return data as AutoLaunchRow
}

/**
 * Queue the automatic first Full redesign for a freshly provisioned tenant.
 *
 * Returns false when no redesign was started (already ran, widget-only tenant,
 * no worker configured, kill switch off). The caller should then reveal the
 * site on the engine template rather than leaving it gated forever.
 */
export async function startAutoLaunchRedesign(tenantId: string): Promise<boolean> {
  if (!autoLaunchEnabled()) {
    console.info('[auto-launch] disabled by AUTO_LAUNCH_REDESIGN', tenantId)
    return false
  }

  const supabase = getSupabaseAdmin()

  const { data: tenant } = await supabase
    .from('tenants')
    .select('site_status')
    .eq('id', tenantId)
    .maybeSingle()
  if (tenant?.site_status === 'widget_only') {
    // Widget-only tenants have no marketing site to redesign.
    return false
  }

  const row = await loadAutoLaunchRow(tenantId)
  if (!row) {
    console.warn('[auto-launch] no site_configs row', tenantId)
    return false
  }
  if (row.auto_launch_redesign_at) {
    // Already ran once. The admin owns redesigns from here on.
    console.info('[auto-launch] first redesign already enqueued', tenantId)
    return false
  }

  if (!canEnqueueBackgroundJobs()) {
    console.warn('[auto-launch] DATABASE_URL not configured — skipping redesign', tenantId)
    return false
  }

  const existing = await getCustomBuildJob(tenantId)
  if (existing && isCustomBuildJobActive(existing)) {
    // An admin got there first; don't stack a second run on the same tenant.
    console.info('[auto-launch] a custom build is already active', tenantId)
    return false
  }

  const startedAt = new Date().toISOString()

  // Same as the admin route's `intent: 'full'` path — clear any prior draft so
  // checkpoint resume only ever applies within this run.
  await supabase
    .from('site_configs')
    .update({ custom_config_draft: null, custom_updated_at: startedAt })
    .eq('tenant_id', tenantId)

  const job: CustomBuildJob = {
    status: 'queued',
    intent: 'full',
    // Empty prompt is intentional: the pipeline self-authors a brief from the
    // intake (enhanceFullRedesignBrief), which is exactly what we want when
    // there is no admin to write a creative seed.
    prompt: '',
    error: null,
    reply: null,
    started_at: startedAt,
    finished_at: null,
    ever_full: true,
    pass: 'queued',
    passes_done: [],
    dead_lettered: false,
    auto_launch: true,
  }
  await setCustomBuildJob(tenantId, job)

  try {
    await enqueueFullRedesign(tenantId, startedAt)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[auto-launch] enqueue failed', tenantId, message)
    await setCustomBuildJob(tenantId, {
      ...job,
      status: 'failed',
      error: message,
      finished_at: new Date().toISOString(),
    })
    return false
  }

  await supabase
    .from('site_configs')
    .update({ auto_launch_redesign_at: startedAt })
    .eq('tenant_id', tenantId)

  await logSystemAction({
    action: 'site.auto_launch_redesign_queued',
    targetType: 'tenant',
    targetId: tenantId,
    metadata: { startedAt, queue: 'graphile' },
  })

  console.info(
    JSON.stringify({ event: 'auto_launch_queued', tenantId, startedAt })
  )
  return true
}

/**
 * Redesign finished successfully: publish the draft over the already-live
 * template site (and approve, for the rare tenant the pre-redesign approval
 * could not take live — a validator that had not passed yet, say).
 *
 * A publish blocked by the quality/uniqueness gate is not an error here — the
 * draft stays for the admin with draft_validation_status='failed', and the site
 * simply stays on the template it launched with rather than waiting on a human.
 */
export async function finishAutoLaunch(tenantId: string): Promise<void> {
  const row = await loadAutoLaunchRow(tenantId)
  if (row?.auto_launch_completed_at) {
    console.info('[auto-launch] finish already ran', tenantId)
    return
  }

  let published = false
  let publishError: string | null = null

  try {
    const result = await publishCustomSiteDraft(tenantId)
    published = true
    await logSystemAction({
      action: 'site.auto_launch_published',
      targetType: 'tenant',
      targetId: tenantId,
      metadata: { warnings: result.warnings?.slice(0, 5) ?? [] },
    })
  } catch (err) {
    publishError = err instanceof Error ? err.message : String(err)
    // The publish gate did its job — a duplicate or AI-smelling design must not
    // go live. Leave the draft for the admin and carry on to the reveal.
    console.error('[auto-launch] publish blocked', tenantId, publishError)
    await logSystemAction({
      action: 'site.auto_launch_publish_blocked',
      targetType: 'tenant',
      targetId: tenantId,
      metadata: { error: publishError.slice(0, 500) },
    })
  }

  // Normally a no-op: the site went live on the template before the redesign
  // started. It still matters for a tenant whose validator had not passed then.
  await autoApproveTenantSite(tenantId, {
    reason: published ? 'redesign_published' : 'publish_blocked',
  })

  if (published) {
    // The site is already live, so the swap to the bespoke design is only real
    // once the cache drops the template. autoApproveTenantSite used to do this
    // on its way past; it no longer runs here.
    await revalidateTenantSiteCache(tenantId).catch((err) =>
      console.warn('[auto-launch] post-publish revalidate failed', err)
    )
  }

  await stampAutoLaunchCompleted(tenantId)

  console.info(
    JSON.stringify({ event: 'auto_launch_finished', tenantId, published })
  )
}

/**
 * Redesign exhausted its attempts. The site is already live on the engine
 * template (approved before the redesign started), so there is nothing to
 * reveal — this closes the sequence out and covers the tenant whose earlier
 * approval could not go through.
 */
export async function failAutoLaunch(tenantId: string): Promise<void> {
  await logSystemAction({
    action: 'site.auto_launch_redesign_failed',
    targetType: 'tenant',
    targetId: tenantId,
    metadata: { revealed: revealOnRedesignFailure() },
  })

  if (!revealOnRedesignFailure()) {
    console.warn(
      '[auto-launch] redesign dead-lettered and reveal disabled — site stays gated',
      tenantId
    )
    return
  }

  await autoApproveTenantSite(tenantId, { reason: 'redesign_failed' })
  await stampAutoLaunchCompleted(tenantId)
  console.info(JSON.stringify({ event: 'auto_launch_failed_revealed', tenantId }))
}

/** Close out the unattended sequence; nothing auto-launch does runs twice. */
async function stampAutoLaunchCompleted(tenantId: string): Promise<void> {
  await getSupabaseAdmin()
    .from('site_configs')
    .update({ auto_launch_completed_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
}

/**
 * Take the site live without an admin — the unattended equivalent of
 * "Approve preview" + "Approve & Go Live". Called on the freshly deployed
 * template site, before the first Full redesign is queued.
 *
 * Applies the same gates the manual route does (validation_status must be
 * 'passed', edit-in-place must be off), then resolves the public status
 * through syncTenantLaunchAccess so the launch-payment gate is preserved:
 * a paid intake goes `active`, an unpaid one goes `awaiting_launch_payment`
 * with a working pay link and flips to `active` when Stripe confirms.
 */
export async function autoApproveTenantSite(
  tenantId: string,
  opts: { reason?: string } = {}
): Promise<boolean> {
  const supabase = getSupabaseAdmin()

  const row = await loadAutoLaunchRow(tenantId)
  // Guarded on approval, not completion, since the two are now separate steps
  // with a whole redesign between them. completed_at is still honoured for
  // tenants that launched under the old redesign-first ordering.
  if (row?.auto_launch_approved_at || row?.auto_launch_completed_at) {
    console.info('[auto-launch] approval already ran', tenantId)
    return false
  }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('validation_status, site_status')
    .eq('id', tenantId)
    .maybeSingle()

  if (!tenant) {
    console.warn('[auto-launch] tenant not found', tenantId)
    return false
  }

  if (tenant.site_status === 'widget_only') return false

  // Same safety gate as POST /api/admin/sites/approve — the automated QA
  // battery (theme/layout consistency, nav, broken links/images, bespoke
  // design) must have passed. Removing the admin does not remove this.
  if (tenant.validation_status !== 'passed') {
    console.warn(
      '[auto-launch] validation not passed — leaving site gated',
      tenantId,
      tenant.validation_status
    )
    await logSystemAction({
      action: 'site.auto_launch_blocked',
      targetType: 'tenant',
      targetId: tenantId,
      metadata: { reason: 'validation_required', validationStatus: tenant.validation_status },
    })
    return false
  }

  if (row?.edit_in_place) {
    console.warn('[auto-launch] edit-in-place on — leaving site gated', tenantId)
    await logSystemAction({
      action: 'site.auto_launch_blocked',
      targetType: 'tenant',
      targetId: tenantId,
      metadata: { reason: 'edit_in_place_on' },
    })
    return false
  }

  const { data: intakeData } = await supabase
    .from('prospect_intakes')
    .select(
      `id, token, status, business_name, contact_email, notification_email,
       intake_tier, tier_total_cents, deposit_required_cents, deposit_paid_cents,
       deposit_status, build_paid_at, balance_paid_at, maintenance_plan,
       preview_approved_at, site_live_at, provisioned_contractor_id, maintenance_started_at`
    )
    .eq('provisioned_contractor_id', tenantId)
    .maybeSingle()
  const intake = intakeData as (ProspectIntakeRow & { token: string }) | null

  if (intake?.id) {
    // Stand in for "Approve preview": without this the intake never leaves
    // pending_approval, so an unpaid customer would see the under-construction
    // page instead of the launch paywall and never get a pay link.
    if (!intake.preview_approved_at) {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from('prospect_intakes')
        .update({ preview_approved_at: now, updated_at: now })
        .eq('id', intake.id)
      if (error) {
        console.error('[auto-launch] failed to stamp preview_approved_at', error.message)
      } else {
        intake.preview_approved_at = now
        await sendLaunchPaymentEmailIfDue(intake)
      }
    }
  }

  const synced = await syncTenantLaunchAccess({
    tenantId,
    intakeId: intake?.id ?? null,
  })

  // The manual approve route never revalidates, so approved sites keep serving
  // the holding page for up to the 60s config cache window. Do it properly here.
  await revalidateTenantSiteCache(tenantId).catch((err) =>
    console.warn('[auto-launch] revalidate failed', err)
  )

  await supabase
    .from('site_configs')
    .update({ auto_launch_approved_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)

  await logSystemAction({
    action: 'site.auto_launch_approved',
    targetType: 'tenant',
    targetId: tenantId,
    metadata: {
      siteStatus: synced.siteStatus,
      reason: opts.reason ?? 'unspecified',
      intakeId: intake?.id ?? null,
    },
  })

  console.info(
    JSON.stringify({
      event: 'auto_launch_approved',
      tenantId,
      siteStatus: synced.siteStatus,
      reason: opts.reason ?? 'unspecified',
    })
  )
  return true
}

/** Email the pay-to-launch link, mirroring approvePreviewAction. */
async function sendLaunchPaymentEmailIfDue(
  intake: ProspectIntakeRow & { token: string }
): Promise<void> {
  try {
    const payment = getIntakePaymentSummary(intake)
    const email = intake.contact_email || intake.notification_email
    if (!email || !payment.checkoutKind || payment.amountCents <= 0) return
    const payKind = payment.checkoutKind === 'balance' ? 'balance' : 'standard_build'
    await sendIntakeLaunchPaymentEmail({
      to: email,
      businessName: intake.business_name,
      intakeUrl: `${publicAppOrigin()}/intake/${intake.token}?pay=${payKind}`,
      amountLabel: payment.label,
      amountCents: payment.amountCents,
    })
  } catch (err) {
    console.error('[auto-launch] launch payment email failed', err)
  }
}
