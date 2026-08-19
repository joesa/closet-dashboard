import * as Sentry from '@sentry/node'

/**
 * Error reporting for the worker.
 *
 * The Next app has had Sentry on every surface; the worker — which runs
 * provisioning, every site build, and every intake generation — had none at
 * all. Its entire failure record was container stdout, rotated at 10MB × 5
 * files on the VM, so "the thing that builds every customer site broke" was
 * discoverable only by SSHing in and reading logs before they aged out.
 *
 * Optional by design: no DSN configured means this is inert, so a local worker
 * and CI behave exactly as before.
 */

let enabled = false

export function initWorkerObservability(build: string): void {
  const dsn = process.env.SENTRY_DSN?.trim() || process.env.NEXT_PUBLIC_SENTRY_DSN?.trim()
  if (!dsn) {
    console.info('[worker] Sentry DSN not set — error reporting disabled')
    return
  }

  Sentry.init({
    dsn,
    release: build || undefined,
    environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    // Jobs are long and infrequent; traces would cost more than they tell us.
    tracesSampleRate: 0,
  })
  enabled = true
  console.info('[worker] Sentry initialised')
}

/**
 * Report a job failure with the context needed to find it again.
 *
 * Graphile retries, so the same failure arrives repeatedly; the tenant and task
 * are tagged rather than buried in the message so they group into one issue
 * instead of thousands.
 */
export function captureJobError(
  error: unknown,
  context: { task: string; jobId?: string | number; tenantId?: string; attempt?: number }
): void {
  if (!enabled) return
  Sentry.withScope((scope) => {
    scope.setTag('worker.task', context.task)
    if (context.tenantId) scope.setTag('tenant', context.tenantId)
    if (context.jobId !== undefined) scope.setContext('job', { id: String(context.jobId), attempt: context.attempt })
    Sentry.captureException(error instanceof Error ? error : new Error(String(error)))
  })
}

/** Flush before the process exits, or reports die with it. */
export async function flushWorkerObservability(timeoutMs = 3000): Promise<void> {
  if (!enabled) return
  try {
    await Sentry.flush(timeoutMs)
  } catch {
    /* shutdown must not block on telemetry */
  }
}
