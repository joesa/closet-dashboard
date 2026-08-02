import { canEnqueueBackgroundJobs, enqueueJob } from '@/lib/jobs/enqueueJob'
import { TASK_FULL_REDESIGN } from '@/lib/jobs/taskIds'

/**
 * Queue a Full redesign (or surgical edit) on Graphile Worker.
 *
 * Shared by the admin custom-build route and the automatic first redesign in
 * src/lib/launch/autoLaunch.ts — the `full_redesign:<tenantId>` job key is what
 * keeps an admin-triggered redesign from racing the automatic one, so both
 * callers must go through here rather than rolling their own add_job.
 *
 * `startedAt` matches custom_build_job.started_at so a Graphile retry resumes
 * the same run instead of starting a new one.
 */
export async function enqueueFullRedesign(tenantId: string, startedAt: string) {
  if (!canEnqueueBackgroundJobs()) {
    throw new Error(
      'DATABASE_URL is not configured — cannot enqueue custom build jobs. Set a session-mode Postgres URI and run the Graphile Worker.'
    )
  }
  await enqueueJob(
    TASK_FULL_REDESIGN,
    { tenantId, startedAt },
    {
      jobKey: `full_redesign:${tenantId}`,
      jobKeyMode: 'replace',
      maxAttempts: 3,
    }
  )
}
