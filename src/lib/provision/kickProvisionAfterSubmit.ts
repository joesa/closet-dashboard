import { canEnqueueBackgroundJobs, enqueueJob } from '@/lib/jobs/enqueueJob'
import { TASK_PROVISION_TENANT } from '@/lib/jobs/taskIds'
import { processProvisionQueue } from '@/lib/provision/processProvisionQueue'
import { publicAppOrigin } from '@/lib/urls'

function loginOrigin(): string {
  return publicAppOrigin('http://localhost:3001')
}

/**
 * Prefer Graphile Worker for provision (no Vercel time limit). Fall back to
 * in-process queue processing when DATABASE_URL is unset (local/dev).
 */
export function kickProvisionAfterSubmit(intakeId: string): void {
  if (canEnqueueBackgroundJobs()) {
    void enqueueJob(
      TASK_PROVISION_TENANT,
      { intakeId },
      {
        jobKey: `provision_tenant:${intakeId}`,
        jobKeyMode: 'replace',
        maxAttempts: 3,
      }
    ).catch((err) => {
      console.error('kickProvisionAfterSubmit enqueue failed:', err)
      // Last resort: try in-process so submit still progresses locally.
      void processProvisionQueue(loginOrigin(), { batchSize: 1, intakeId }).catch(
        (e) => console.error('kickProvisionAfterSubmit fallback failed:', e)
      )
    })
    return
  }

  void processProvisionQueue(loginOrigin(), { batchSize: 1, intakeId }).catch((err) => {
    console.error('kickProvisionAfterSubmit failed:', err)
  })
}
