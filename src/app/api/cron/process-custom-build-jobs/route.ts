import { NextResponse } from 'next/server'
import { listActiveCustomBuildTenantIds, getCustomBuildJob } from '@/lib/ai/customBuildJob'
import { canEnqueueBackgroundJobs, enqueueJob } from '@/lib/jobs/enqueueJob'
import { TASK_FULL_REDESIGN } from '@/lib/jobs/taskIds'

/**
 * Safety-net cron: re-enqueue queued Full redesign jobs that the worker
 * never claimed (e.g. worker was offline when add_job ran).
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

  const ids = await listActiveCustomBuildTenantIds()
  const enqueued: string[] = []
  for (const tenantId of ids) {
    const job = await getCustomBuildJob(tenantId)
    if (!job || job.status !== 'queued') continue
    try {
      await enqueueJob(
        TASK_FULL_REDESIGN,
        { tenantId, startedAt: job.started_at },
        {
          jobKey: `full_redesign:${tenantId}`,
          jobKeyMode: 'replace',
          maxAttempts: 3,
        }
      )
      enqueued.push(tenantId)
    } catch (err) {
      console.error('[cron custom-build] enqueue failed', tenantId, err)
    }
  }

  return NextResponse.json({
    enqueued: enqueued.length,
    tenantIds: enqueued,
  })
}
