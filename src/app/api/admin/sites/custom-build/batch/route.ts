import { NextResponse } from 'next/server'
import { getCurrentAdmin, logAdminAction } from '@/lib/admin'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  getAndReconcileCustomBuildJob,
  isCustomBuildJobActive,
  setCustomBuildJob,
  type CustomBuildJob,
} from '@/lib/ai/customBuildJob'
import { enqueueFullRedesign } from '@/lib/jobs/enqueueFullRedesign'
import { loadFactsBriefForTenant } from '@/lib/intake/factsBriefForTenant'
import { canEnqueueBackgroundJobs } from '@/lib/jobs/enqueueJob'
import {
  MAX_FULL_REDESIGN_BATCH_SIZE,
  normalizeFullRedesignTenantIds,
} from '@/lib/ai/batchFullRedesign'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const adminUser = await getCurrentAdmin()
  if (!adminUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canEnqueueBackgroundJobs()) {
    return NextResponse.json({ error: 'DATABASE_URL is not configured' }, { status: 503 })
  }

  const body = await req.json().catch(() => ({}))
  const tenantIds = normalizeFullRedesignTenantIds(body.tenantIds)
  if (tenantIds.length === 0) {
    return NextResponse.json({ error: 'Select at least one site' }, { status: 400 })
  }
  if (tenantIds.length > MAX_FULL_REDESIGN_BATCH_SIZE) {
    return NextResponse.json(
      { error: `Select no more than ${MAX_FULL_REDESIGN_BATCH_SIZE} sites` },
      { status: 400 }
    )
  }

  const supabase = getSupabaseAdmin()
  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('id, business_name, site_status, site_configs!inner(tenant_id)')
    .in('id', tenantIds)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const byId = new Map((tenants ?? []).map((tenant) => [tenant.id, tenant]))
  const results: Array<{ tenantId: string; businessName?: string; status: 'queued' | 'skipped' | 'failed'; message: string }> = []

  for (const tenantId of tenantIds) {
    const tenant = byId.get(tenantId)
    if (!tenant || tenant.site_status === 'widget_only') {
      results.push({ tenantId, status: 'skipped', message: tenant ? 'Widget-only tenant' : 'Site not found' })
      continue
    }

    const existing = await getAndReconcileCustomBuildJob(tenantId)
    if (existing && isCustomBuildJobActive(existing)) {
      results.push({ tenantId, businessName: tenant.business_name, status: 'skipped', message: 'A redesign is already active' })
      continue
    }

    const startedAt = new Date().toISOString()
    // Same as auto-launch and the single-site admin route: the owner's facts
    // ride with the job, so a fleet rebuild does not quietly strip every site
    // back to what site_configs could summarise in 900 characters.
    const factsBrief = await loadFactsBriefForTenant(tenantId)
    const job: CustomBuildJob = {
      status: 'queued',
      intent: 'full',
      prompt: '',
      facts_brief: factsBrief || null,
      error: null,
      reply: null,
      started_at: startedAt,
      finished_at: null,
      ever_full: true,
      pass: 'queued',
      passes_done: [],
      dead_lettered: false,
    }

    await supabase
      .from('site_configs')
      .update({ custom_config_draft: null, custom_updated_at: startedAt })
      .eq('tenant_id', tenantId)
    await setCustomBuildJob(tenantId, job)

    try {
      await enqueueFullRedesign(tenantId, startedAt)
      results.push({ tenantId, businessName: tenant.business_name, status: 'queued', message: 'Full Redesign queued' })
      await logAdminAction({
        actor: adminUser,
        action: 'site.custom_build_batch_queued',
        targetType: 'tenant',
        targetId: tenantId,
        metadata: { startedAt, batchSize: tenantIds.length },
      })
    } catch (enqueueError) {
      const message = enqueueError instanceof Error ? enqueueError.message : String(enqueueError)
      await setCustomBuildJob(tenantId, { ...job, status: 'failed', error: message, finished_at: new Date().toISOString() })
      results.push({ tenantId, businessName: tenant.business_name, status: 'failed', message })
    }
  }

  return NextResponse.json({ results })
}