import { makeWorkerUtils } from 'graphile-worker'
import { createGraphilePool } from '@/lib/jobs/databaseUrl'
import { loadWorkerEnv } from './loadEnv'

/**
 * Install / upgrade the graphile_worker schema.
 * Run once against production with a session-mode DATABASE_URL (owner/migration role).
 *
 *   npm run worker:migrate
 */
async function main() {
  loadWorkerEnv()
  const connectionString = process.env.DATABASE_URL?.trim()
  if (!connectionString) {
    throw new Error('DATABASE_URL is required')
  }

  const pgPool = createGraphilePool(connectionString)
  const utils = await makeWorkerUtils({ pgPool })
  try {
    await utils.migrate()
    console.log('[worker:migrate] graphile_worker schema is up to date')
  } finally {
    await utils.release()
    await pgPool.end()
  }
}

main().catch((err) => {
  console.error('[worker:migrate] failed:', err)
  process.exit(1)
})
