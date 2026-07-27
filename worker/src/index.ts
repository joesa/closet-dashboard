import { run, type TaskList } from 'graphile-worker'
import { createGraphilePool } from '@/lib/jobs/databaseUrl'
import { loadWorkerEnv } from './loadEnv'
import {
  TASK_ADMIN_GENERATE_BEFORE,
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

loadWorkerEnv()

const connectionString = process.env.DATABASE_URL?.trim()
if (!connectionString) {
  console.error(
    '[worker] DATABASE_URL is required (Supabase session-mode Postgres URI on port 5432).'
  )
  process.exit(1)
}

const taskList: TaskList = {
  [TASK_FULL_REDESIGN]: fullRedesignTask,
  [TASK_PROVISION_TENANT]: provisionTenantTask,
  [TASK_INTAKE_GENERATE_SITE]: intakeGenerateSiteTask,
  [TASK_INTAKE_GENERATE_IMAGES]: intakeGenerateImagesTask,
  [TASK_ADMIN_GENERATE_IMAGES]: adminGenerateImagesTask,
  [TASK_ADMIN_GENERATE_BEFORE]: adminGenerateBeforeTask,
}

async function main() {
  console.log(
    '[worker] starting Graphile Worker (concurrency=1). Tasks:',
    Object.keys(taskList).join(', ')
  )

  const pgPool = createGraphilePool(connectionString)
  const runner = await run({
    pgPool,
    concurrency: 1,
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
