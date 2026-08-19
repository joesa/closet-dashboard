import { hostname } from 'node:os'
import { run, type TaskList } from 'graphile-worker'
import { createGraphilePool } from '@/lib/jobs/databaseUrl'
import {
  buildWorkerIdentity,
  heartbeatWorkerInstance,
  markWorkerInstanceStopped,
  pruneWorkerInstances,
  registerWorkerInstance,
  WORKER_HEARTBEAT_MS,
} from '@/lib/jobs/workerInstance'
import { loadWorkerEnv } from './loadEnv'
import { startScheduler } from './scheduler'
import {
  captureJobError,
  flushWorkerObservability,
  initWorkerObservability,
} from './observability'
import {
  TASK_ADMIN_GENERATE_BEFORE,
  TASK_SPEC_BUILD_ADVANCE,
  TASK_ADMIN_GENERATE_IMAGES,
  TASK_FULL_REDESIGN,
  TASK_INTAKE_GENERATE_IMAGES,
  TASK_INTAKE_GENERATION,
  TASK_INTAKE_GENERATE_SITE,
  TASK_PROVISION_TENANT,
  TASK_TEMP_PREVIEW_REVERT,
} from './taskIds'
import { fullRedesignTask } from './tasks/fullRedesign'
import { provisionTenantTask } from './tasks/provisionTenant'
import { intakeGenerateSiteTask } from './tasks/intakeGenerateSite'
import { intakeGenerateImagesTask } from './tasks/intakeGenerateImages'
import { intakeGenerationTask } from './tasks/intakeGeneration'
import { adminGenerateImagesTask } from './tasks/adminGenerateImages'
import { adminGenerateBeforeTask } from './tasks/adminGenerateBefore'
import { specBuildAdvanceTask } from './tasks/specBuildAdvance'
import { tempPreviewRevertTask } from './tasks/tempPreviewRevert'

loadWorkerEnv()

const connectionString = process.env.DATABASE_URL?.trim()
if (!connectionString) {
  console.error(
    '[worker] DATABASE_URL is required (Supabase session-mode Postgres URI on port 5432).'
  )
  process.exit(1)
}

/**
 * Concurrent jobs per worker process. Historically pinned to 1 because Render's
 * 512MB Starter box OOMed on two Full redesigns; on a ≥2GB host that limit is
 * just a throughput cap (every intake queued behind one lane). Raise via
 * WORKER_CONCURRENCY, bounded by the Supabase session connection limit.
 */
function getWorkerConcurrency(): number {
  const raw = process.env.WORKER_CONCURRENCY?.trim()
  if (!raw) return 3
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 1) {
    console.warn(
      `[worker] ignoring invalid WORKER_CONCURRENCY=${raw} (want a positive integer); using 3`
    )
    return 3
  }
  return parsed
}

/**
 * Report, then rethrow. Graphile's retry semantics are unchanged — this only
 * ensures the failure leaves the machine before the logs rotate.
 */
function reported(name: string, task: TaskList[string]): TaskList[string] {
  return async (payload, helpers) => {
    try {
      return await (task as (p: unknown, h: unknown) => Promise<void>)(payload, helpers)
    } catch (err) {
      const p = (payload ?? {}) as { tenantId?: string }
      captureJobError(err, {
        task: name,
        jobId: helpers.job?.id,
        tenantId: p.tenantId,
        attempt: helpers.job?.attempts,
      })
      throw err
    }
  }
}

const rawTaskList: TaskList = {
  [TASK_FULL_REDESIGN]: fullRedesignTask,
  [TASK_PROVISION_TENANT]: provisionTenantTask,
  [TASK_INTAKE_GENERATE_SITE]: intakeGenerateSiteTask,
  [TASK_INTAKE_GENERATE_IMAGES]: intakeGenerateImagesTask,
  [TASK_INTAKE_GENERATION]: intakeGenerationTask,
  [TASK_ADMIN_GENERATE_IMAGES]: adminGenerateImagesTask,
  [TASK_ADMIN_GENERATE_BEFORE]: adminGenerateBeforeTask,
  [TASK_SPEC_BUILD_ADVANCE]: specBuildAdvanceTask,
  [TASK_TEMP_PREVIEW_REVERT]: tempPreviewRevertTask,
}

/** Same tasks, each reporting its own failures before Graphile retries them. */
const taskList: TaskList = Object.fromEntries(
  Object.entries(rawTaskList).map(([name, task]) => [name, reported(name, task)])
) as TaskList

async function main() {
  const concurrency = getWorkerConcurrency()
  const identity = buildWorkerIdentity({
    hostname: hostname(),
    concurrency,
    taskIds: Object.keys(taskList),
  })

  console.log(
    `[worker] starting Graphile Worker (concurrency=${concurrency}, build=${identity.gitSha ?? 'unknown'}, instance=${identity.id}). Tasks:`,
    Object.keys(taskList).join(', ')
  )

  initWorkerObservability(identity.gitSha ?? '')
  const stopScheduler = startScheduler()

  // One dedicated LISTEN client + one per concurrent job.
  const pgPool = createGraphilePool(connectionString, { max: concurrency + 2 })
  const runner = await run({
    pgPool,
    concurrency,
    pollInterval: 1000,
    // Install / upgrade graphile_worker schema on boot.
    taskList,
    // We handle SIGTERM/SIGINT ourselves (see shutdown below). Graphile's own
    // handler exits the process as soon as the drain finishes, which killed the
    // registry's "this was a clean stop" write before it reached Postgres — so
    // every redeploy looked identical to a crash.
    noHandleSignals: true,
  })

  // Publish which build is running. Best-effort: a registry write must never
  // keep a healthy worker from claiming jobs, so failures only log.
  const registered = await registerWorkerInstance(pgPool, identity)
  if (!registered.ok) {
    console.warn(`[worker] could not register instance: ${registered.error}`)
  }
  await pruneWorkerInstances(pgPool)

  // unref so a pending beat cannot hold the process open during shutdown.
  const heartbeat = setInterval(() => {
    void heartbeatWorkerInstance(pgPool, identity.id).then((res) => {
      if (!res.ok) console.warn(`[worker] heartbeat failed: ${res.error}`)
    })
  }, WORKER_HEARTBEAT_MS)
  heartbeat.unref()

  let shuttingDown = false

  /**
   * Ordered so the record survives the worst case.
   *
   * `stopped_at` means "shutdown was requested", not "drain finished". A Full
   * redesign can run for minutes while docker's stop_grace_period is 60s, so
   * waiting for the drain before writing would lose the record in exactly the
   * case worth distinguishing — a deliberate stop that ran long and got
   * SIGKILLed looks the same as an OOM.
   */
  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return
    shuttingDown = true
    clearInterval(heartbeat)
    console.log(`[worker] ${signal} received — draining`)

    const marked = await markWorkerInstanceStopped(pgPool, identity.id)
    if (!marked.ok) {
      console.warn(`[worker] could not record shutdown: ${marked.error}`)
    }

    try {
      // Waits for in-flight jobs. Bounded below docker's 60s grace so we exit
      // on our own terms rather than being killed mid-write.
      await Promise.race([
        runner.stop(),
        new Promise((resolve) => setTimeout(resolve, 45_000)).then(() => {
          console.warn('[worker] drain still running after 45s — exiting anyway')
        }),
      ])
    } catch (err) {
      console.warn('[worker] error during drain:', err)
    }

    stopScheduler()
    // Reports queued during the drain would otherwise die with the process.
    await flushWorkerObservability()
    await pgPool.end().catch(() => undefined)
    process.exit(0)
  }

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      void shutdown(signal)
    })
  }

  console.log('[worker] connected — listening for jobs')
  try {
    await runner.promise
  } finally {
    clearInterval(heartbeat)
    // Non-signal exit (the runner stopped on its own). The UPDATE is
    // idempotent, so overlapping with shutdown() above is harmless.
    if (!shuttingDown) {
      await markWorkerInstanceStopped(pgPool, identity.id)
    }
  }
}

main().catch((err) => {
  console.error('[worker] fatal:', err)
  process.exit(1)
})
