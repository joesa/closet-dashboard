import { NextResponse } from 'next/server'
import {
  CUSTOM_BUILD_JOB_QUEUED_ALERT_MS,
  getCustomBuildJob,
  isCustomBuildJobStale,
  jobAgeMs,
  jobIdleMs,
  listActiveCustomBuildTenantIds,
} from '@/lib/ai/customBuildJob'
import { canEnqueueBackgroundJobs } from '@/lib/jobs/enqueueJob'
import { enqueueFullRedesign } from '@/lib/jobs/enqueueFullRedesign'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { isCustomBuildJob } from '@/lib/ai/customBuildJob'

/**
 * Safety-net cron: re-enqueue queued Full redesign jobs that the worker
 * never claimed, and emit [ALERT custom-build] for SLO breaches.
 */
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!canEnqueueBackgroundJobs()) {
    return NextResponse.json({
      enqueued: 0,
      skipped: true,
      reason: 'DATABASE_URL not configured',
    })
  }

  const now = Date.now()
  const alerts: string[] = []

  // Scan for SLO alerts (queued >2m, processing with stale heartbeat).
  const supabase = getSupabaseAdmin()
  const { data: rows } = await supabase
    .from('site_configs')
    .select('tenant_id, brand_name, custom_build_job')
    .not('custom_build_job', 'is', null)
    .limit(80)

  for (const row of rows || []) {
    const job = isCustomBuildJob(row.custom_build_job) ? row.custom_build_job : null
    if (!job) continue
    const label =
      (typeof row.brand_name === 'string' && row.brand_name) ||
      (typeof row.tenant_id === 'string' ? row.tenant_id : 'unknown')
    if (job.status === 'queued' && jobAgeMs(job, now) >= CUSTOM_BUILD_JOB_QUEUED_ALERT_MS) {
      const msg = `[ALERT custom-build] queued_slow tenant=${row.tenant_id} brand=${label} ageMs=${jobAgeMs(job, now)}`
      console.error(msg)
      alerts.push(msg)
    }
    if (
      job.status === 'processing' &&
      (isCustomBuildJobStale(job, now) || jobIdleMs(job, now) >= 5 * 60 * 1000)
    ) {
      const msg = `[ALERT custom-build] stale_heartbeat tenant=${row.tenant_id} brand=${label} idleMs=${jobIdleMs(job, now)}`
      console.error(msg)
      alerts.push(msg)
    }
  }

  const ids = await listActiveCustomBuildTenantIds()
  const enqueued: string[] = []
  for (const tenantId of ids) {
    const job = await getCustomBuildJob(tenantId)
    if (!job || job.status !== 'queued') continue
    try {
      await enqueueFullRedesign(tenantId, job.started_at)
      enqueued.push(tenantId)
    } catch (err) {
      console.error('[cron custom-build] enqueue failed', tenantId, err)
    }
  }

  return NextResponse.json({
    enqueued: enqueued.length,
    tenantIds: enqueued,
    alerts: alerts.length,
  })
}
