import { canEnqueueBackgroundJobs, enqueueJob } from '@/lib/jobs/enqueueJob'
import { TASK_SPEC_BUILD_ADVANCE } from '@/lib/jobs/taskIds'

/**
 * Hand a spec build to the worker to advance on its own.
 *
 * Deliberately fire-and-forget with no in-process fallback, unlike
 * `kickProvisionAfterSubmit`. A spec build's steps take minutes and cost money;
 * running one inside a web request would block it past any sensible timeout and
 * leave a half-finished build if the request died. When no worker is available
 * the build simply stays where it is, which is a visible, recoverable state an
 * admin can drive by hand from the queue.
 *
 * The `jobKey` is the mutex: a double-enqueue for the same build collapses to a
 * single job, which matters because the scraper webhook can fire twice.
 */
export function kickSpecBuild(specBuildId: string): void {
  if (!canEnqueueBackgroundJobs()) {
    console.info('[spec-builds] no worker configured; leaving build for manual advance', specBuildId)
    return
  }

  void enqueueJob(
    TASK_SPEC_BUILD_ADVANCE,
    { specBuildId },
    { jobKey: `spec_build:${specBuildId}`, jobKeyMode: 'replace', maxAttempts: 2 }
  ).catch((err) => console.error('[spec-builds] enqueue failed', specBuildId, err))
}
