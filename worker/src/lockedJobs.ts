/**
 * Prints the number of jobs currently locked by a worker, and nothing else.
 *
 * Used by worker/scripts/redeploy.sh as a pre-flight check. Recreating the
 * container while a job holds a lock does not just interrupt that job — the
 * dead worker keeps the lock, and Graphile will not hand the job to anyone else
 * until the lock expires (4 hours by default). The job appears frozen mid-run
 * next to a completely idle worker.
 *
 * Recovering from that is `graphile_worker.force_unlock_workers(array[...])`
 * with the stale worker id from `locked_by`.
 */
import { createGraphilePool, getGraphileDatabaseUrl } from '@/lib/jobs/databaseUrl'

async function main() {
  const pool = createGraphilePool(getGraphileDatabaseUrl(), { max: 1 })
  try {
    const { rows } = await pool.query(
      `select count(*)::int as locked from graphile_worker.jobs where locked_at is not null`
    )
    console.log(rows[0]?.locked ?? 0)
  } finally {
    await pool.end()
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    // Fail loud but distinguishable: the caller must not read a connection
    // error as "zero jobs running" and recreate the container anyway.
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
)
