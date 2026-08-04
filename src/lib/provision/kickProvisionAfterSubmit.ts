import { canEnqueueBackgroundJobs, enqueueJob } from '@/lib/jobs/enqueueJob'
import { TASK_PROVISION_TENANT } from '@/lib/jobs/taskIds'
import { processProvisionQueue } from '@/lib/provision/processProvisionQueue'
import { publicAppOrigin } from '@/lib/urls'

function loginOrigin(): string {
  return publicAppOrigin('http://localhost:3001')
}

export type ProvisionKickResult = {
  /** The provision job is durably queued on the worker. */
  queued: boolean
  /** How the deploy was started: 'worker' | 'in_process' | 'failed'. */
  via: 'worker' | 'in_process' | 'failed'
  error?: string
}

/**
 * Start the deploy for a freshly submitted intake — the unattended equivalent
 * of an admin opening the sandbox builder and clicking "Deploy Simulated Site".
 *
 * **Awaited on purpose.** This used to be a fire-and-forget `void enqueueJob(…)`
 * called from the intake POST handler, which returned its response immediately
 * afterwards. A serverless function is free to freeze the instance the moment it
 * responds, so the add_job round-trip was routinely killed before it committed:
 * the provision_jobs row sat `pending` and nothing deployed until the 05:00 cron
 * swept it up — up to 24 hours later. To everyone watching it looked like intake
 * submit simply never provisioned, and an admin ended up deploying by hand.
 *
 * Enqueueing is a single INSERT, so awaiting it costs the submitter milliseconds
 * and makes the deploy durable. Only the no-worker fallback (local dev, where
 * the process outlives the request) stays detached, because that path runs the
 * whole provision inline and can take minutes.
 */
export async function kickProvisionAfterSubmit(
  intakeId: string
): Promise<ProvisionKickResult> {
  if (canEnqueueBackgroundJobs()) {
    try {
      await enqueueJob(
        TASK_PROVISION_TENANT,
        { intakeId },
        {
          jobKey: `provision_tenant:${intakeId}`,
          jobKeyMode: 'replace',
          maxAttempts: 3,
        }
      )
      return { queued: true, via: 'worker' }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      console.error('kickProvisionAfterSubmit enqueue failed:', error)
      // Last resort: try in-process so submit still progresses locally.
      void processProvisionQueue(loginOrigin(), { batchSize: 1, intakeId }).catch(
        (e) => console.error('kickProvisionAfterSubmit fallback failed:', e)
      )
      return { queued: false, via: 'failed', error }
    }
  }

  void processProvisionQueue(loginOrigin(), { batchSize: 1, intakeId }).catch((err) => {
    console.error('kickProvisionAfterSubmit failed:', err)
  })
  return { queued: true, via: 'in_process' }
}
