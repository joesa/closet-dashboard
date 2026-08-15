import { createGraphilePool } from '@/lib/jobs/databaseUrl'
import {
  summarizeWorkerInstances,
  type WorkerInstanceRow,
} from '@/lib/jobs/workerInstance'
import { loadWorkerEnv } from './loadEnv'

/**
 * Print which build of the worker is running, from any machine with
 * DATABASE_URL.
 *
 *   npm run worker:status
 *
 * Answers "did the VM pick up my commit?" without SSH. The queue cannot answer
 * it — with nothing runnable, a live worker and a stopped container look the
 * same in graphile_worker.jobs.
 */
async function main() {
  loadWorkerEnv()
  const connectionString = process.env.DATABASE_URL?.trim()
  if (!connectionString) {
    throw new Error('DATABASE_URL is required')
  }

  const pool = createGraphilePool(connectionString)
  try {
    const { rows } = await pool.query<WorkerInstanceRow>(
      `select id, git_sha, image_built_at, hostname, concurrency, task_ids,
              started_at, last_seen_at, stopped_at
         from public.worker_instances
        order by started_at desc
        limit 10`
    )

    if (rows.length === 0) {
      console.log(
        'No worker instances registered. Either no worker has booted since this table was added, or it cannot reach the database.'
      )
      return
    }

    const instances = summarizeWorkerInstances(rows)
    for (const inst of instances) {
      const state = inst.alive
        ? 'ALIVE'
        : inst.stopped_at
          ? 'stopped'
          : 'STALE (no heartbeat)'
      const age = Math.round(inst.msSinceHeartbeat / 1000)
      console.log(
        [
          `${state.padEnd(20)} build=${inst.git_sha?.slice(0, 7) ?? 'unknown'}`,
          `host=${inst.hostname ?? '?'}`,
          `concurrency=${inst.concurrency ?? '?'}`,
          `started=${inst.started_at}`,
          `last_seen=${age}s ago`,
        ].join('  ')
      )
    }

    const live = instances.filter((i) => i.alive)
    if (live.length === 0) {
      console.log('\nNo live worker. Nothing is claiming jobs right now.')
    }
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error('[worker:status] failed:', err)
  process.exit(1)
})
