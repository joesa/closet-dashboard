import type { Task } from 'graphile-worker'
import { advanceSpecBuild } from '@/lib/spec/advanceSpecBuild'
import { TASK_SPEC_BUILD_ADVANCE } from '../taskIds'

export type SpecBuildAdvancePayload = { specBuildId: string }

/**
 * Drive one spec build forward, one step per run.
 *
 * Self-re-enqueuing rather than a chain: `advanceSpecBuild` performs exactly
 * one transition and reports whether more remains, so the queue holds at most
 * one live job per build. The `jobKey` is the mutex — `jobKeyMode: 'replace'`
 * collapses a double-enqueue into a single job, which matters because the
 * scraper webhook can fire twice for the same run.
 *
 * The long legs (provision_tenant, full_redesign) are handoffs: this task
 * enqueues them and stops. Control returns through specBuildHooks, so nothing
 * here polls and no job sits burning a worker slot waiting on a redesign.
 */
export const specBuildAdvanceTask: Task = async (payload, helpers) => {
  const { specBuildId } = (payload ?? {}) as SpecBuildAdvancePayload
  if (!specBuildId) throw new Error('spec_build_advance requires specBuildId')

  const result = await advanceSpecBuild(specBuildId)
  helpers.logger.info(
    `spec_build_advance ${specBuildId}: ${result.from} -> ${result.to}${
      result.note ? ` (${result.note})` : ''
    }`
  )

  if (!result.done) {
    await helpers.addJob(
      TASK_SPEC_BUILD_ADVANCE,
      { specBuildId },
      { jobKey: `spec_build:${specBuildId}`, jobKeyMode: 'replace', maxAttempts: 2 }
    )
  }
}
