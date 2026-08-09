import { run, type TaskList } from 'graphile-worker'
import { createGraphilePool } from '@/lib/jobs/databaseUrl'
import { loadWorkerEnv } from './loadEnv'
import {
  TASK_ADMIN_GENERATE_BEFORE,
  TASK_SPEC_BUILD_ADVANCE,
  TASK_ADMIN_GENERATE_IMAGES,
  TASK_FULL_REDESIGN,
  TASK_INTAKE_GENERATE_IMAGES,
  TASK_INTAKE_GENERATE_SITE,
  TASK_PROVISION_TENANT,
} from './taskIds'
import { fullRedesignTask } from './tasks/fullRedesign'
import { provisionTenantTask } from './tasks/provisionTenant'
import { intakeGenerateSiteTask } from './tasks/intakeGenerateSite'
import { intakeGenerateImagesTask } from './tasks/intakeGenerateImages'
import { adminGenerateImagesTask } from './tasks/adminGenerateImages'
import { adminGenerateBeforeTask } from './tasks/adminGenerateBefore'
import { specBuildAdvanceTask } from './tasks/specBuildAdvance'

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

const taskList: TaskList = {
  [TASK_FULL_REDESIGN]: fullRedesignTask,
  [TASK_PROVISION_TENANT]: provisionTenantTask,
  [TASK_INTAKE_GENERATE_SITE]: intakeGenerateSiteTask,
  [TASK_INTAKE_GENERATE_IMAGES]: intakeGenerateImagesTask,
  [TASK_ADMIN_GENERATE_IMAGES]: adminGenerateImagesTask,
  [TASK_ADMIN_GENERATE_BEFORE]: adminGenerateBeforeTask,
  [TASK_SPEC_BUILD_ADVANCE]: specBuildAdvanceTask,
}

async function main() {
  const concurrency = getWorkerConcurrency()

  console.log(
    `[worker] starting Graphile Worker (concurrency=${concurrency}). Tasks:`,
    Object.keys(taskList).join(', ')
  )

  // One dedicated LISTEN client + one per concurrent job.
  const pgPool = createGraphilePool(connectionString, { max: concurrency + 2 })
  const runner = await run({
    pgPool,
    concurrency,
    pollInterval: 1000,
    // Install / upgrade graphile_worker schema on boot.
    taskList,
  })

  console.log('[worker] connected — listening for jobs')
  await runner.promise
}

main().catch((err) => {
  console.error('[worker] fatal:', err)
  process.exit(1)
})
