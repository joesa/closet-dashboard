import { makeWorkerUtils, type WorkerUtils, type TaskSpec } from 'graphile-worker'
import {
  canEnqueueBackgroundJobs,
  createGraphilePool,
  getGraphileDatabaseUrl,
} from '@/lib/jobs/databaseUrl'

export { canEnqueueBackgroundJobs }

let utilsPromise: Promise<WorkerUtils> | null = null

async function getWorkerUtils(): Promise<WorkerUtils> {
  if (!utilsPromise) {
    const pgPool = createGraphilePool(getGraphileDatabaseUrl())
    utilsPromise = makeWorkerUtils({ pgPool })
  }
  return utilsPromise
}

export type EnqueueJobOptions = {
  /** Deduplicate / replace in-flight jobs with the same key. */
  jobKey?: string
  jobKeyMode?: 'replace' | 'preserve_run_at' | 'unsafe_dedupe'
  /** Cap expensive AI retries (default 3). */
  maxAttempts?: number
  runAt?: Date
  priority?: number
}

/**
 * Enqueue a Graphile Worker task. The always-on worker process picks it up —
 * never run the heavy work inside a Vercel function.
 */
export async function enqueueJob(
  identifier: string,
  payload: Record<string, unknown>,
  opts?: EnqueueJobOptions
): Promise<{ id: string }> {
  const utils = await getWorkerUtils()
  const spec: TaskSpec = {
    maxAttempts: opts?.maxAttempts ?? 3,
    jobKey: opts?.jobKey,
    jobKeyMode: opts?.jobKeyMode ?? 'replace',
    runAt: opts?.runAt,
    priority: opts?.priority,
  }
  const job = await utils.addJob(identifier, payload, spec)
  return { id: String(job.id) }
}
