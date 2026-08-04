import { assertInitialAdminPreviewReady } from '@/lib/launch/initialAdminPreview'

export type InitialSiteWaitResult = {
  ready: boolean
  attempts: number
  waitedMs: number
  lastError?: string
}

/**
 * Callers below must read each variable as a static property access, never as a
 * computed `process.env[name]` lookup — scripts/worker-env-scan.mjs walks the
 * worker's import graph for static accesses, and a dynamic one is invisible to
 * it, which is how a required key gets left off the worker host.
 */
function positiveEnvMs(name: string, raw: string | undefined, fallback: number): number {
  const value = raw?.trim()
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(`[auto-launch] ignoring invalid ${name}=${value}; using ${fallback}ms`)
    return fallback
  }
  return parsed
}

/** Total budget for the freshly provisioned site to become previewable. */
function waitBudgetMs(): number {
  return positiveEnvMs(
    'AUTO_LAUNCH_SITE_WAIT_MS',
    process.env.AUTO_LAUNCH_SITE_WAIT_MS,
    10 * 60_000
  )
}

/** Gap between readiness probes. */
function pollIntervalMs(): number {
  return positiveEnvMs(
    'AUTO_LAUNCH_SITE_POLL_MS',
    process.env.AUTO_LAUNCH_SITE_POLL_MS,
    15_000
  )
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Block until the just-provisioned engine site actually serves through the
 * admin bypass — i.e. until the deploy the intake triggered is *finished*, not
 * merely recorded in the database.
 *
 * Provisioning returns as soon as the tenant, its site config and its Vercel
 * domain are written; the subdomain still has to register, resolve and get a
 * certificate, which takes longer than the redesign job's whole retry budget
 * (3 attempts, seconds apart). Enqueueing the redesign the instant provisioning
 * returned therefore burned all three attempts on "not reachable yet" and
 * dead-lettered the automatic first redesign on a site that was about to be
 * perfectly fine.
 *
 * Callers run this on the always-on worker, where there is no request timeout.
 * A `false` result is not fatal: the redesign task re-checks the same gate, so
 * the caller may still queue it and let the worker retry.
 */
export async function waitForInitialSiteDeployed(
  tenantId: string,
  opts: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<InitialSiteWaitResult> {
  const timeoutMs = opts.timeoutMs ?? waitBudgetMs()
  const intervalMs = opts.intervalMs ?? pollIntervalMs()
  const startedAt = Date.now()

  let attempts = 0
  let lastError: string | undefined

  for (;;) {
    attempts += 1
    try {
      await assertInitialAdminPreviewReady(tenantId)
      const waitedMs = Date.now() - startedAt
      console.info(
        JSON.stringify({ event: 'initial_site_ready', tenantId, attempts, waitedMs })
      )
      return { ready: true, attempts, waitedMs }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
    }

    // Only sleep when there is room for another probe after it.
    const elapsed = Date.now() - startedAt
    if (elapsed + intervalMs >= timeoutMs) {
      const waitedMs = Date.now() - startedAt
      console.warn(
        JSON.stringify({
          event: 'initial_site_wait_timeout',
          tenantId,
          attempts,
          waitedMs,
          error: lastError,
        })
      )
      return { ready: false, attempts, waitedMs, lastError }
    }
    await sleep(intervalMs)
  }
}
