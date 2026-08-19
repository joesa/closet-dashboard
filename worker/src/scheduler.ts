/**
 * Interval jobs driven by the worker rather than by Vercel cron.
 *
 * Vercel's Hobby plan permits daily crons only — a fifteen-minute schedule
 * is rejected at deploy time, and the rejection surfaces as "no deployment
 * happened" rather than as a visible error, which is exactly how three commits
 * silently failed to ship. Two of these jobs are useless at daily resolution:
 * a stuck provisioning job would wait up to 24 hours to be requeued, and a
 * dunning reminder that arrives a day late arrives after the grace window has
 * already moved.
 *
 * The worker VM is always on and already keeps a heartbeat, so it is the
 * natural scheduler. It calls the same HTTP endpoints the Vercel crons call —
 * one implementation, two triggers — authenticated with CRON_SECRET. The daily
 * Vercel crons stay as a backstop for when the VM is down.
 */

type ScheduledJob = { path: string; everyMs: number }

const MINUTE = 60_000

const JOBS: ScheduledJob[] = [
  // A job stranded in `processing` blocks a customer's site from ever building.
  { path: '/api/cron/reap-provision-jobs', everyMs: 20 * MINUTE },
  // The only automatic recovery if a provision never got picked up.
  { path: '/api/cron/process-provision-jobs', everyMs: 15 * MINUTE },
  // Reminders are idempotency-keyed, so a frequent tick cannot double-send.
  { path: '/api/cron/dunning', everyMs: 6 * 60 * MINUTE },
]

function appOrigin(): string | null {
  const raw =
    process.env.PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!raw) return null
  return raw.replace(/\/+$/, '')
}

async function runOnce(origin: string, secret: string, job: ScheduledJob): Promise<void> {
  try {
    const res = await fetch(`${origin}${job.path}`, {
      headers: { authorization: `Bearer ${secret}` },
    })
    if (!res.ok) {
      console.warn(`[scheduler] ${job.path} responded ${res.status}`)
      return
    }
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null
    // Only log when something actually happened; a quiet tick every 15 minutes
    // would bury the interesting lines.
    const noteworthy =
      body &&
      Object.entries(body).some(
        ([, v]) => (Array.isArray(v) && v.length > 0) || (typeof v === 'number' && v > 0)
      )
    if (noteworthy) {
      console.info(JSON.stringify({ event: 'scheduled_job', path: job.path, result: body }))
    }
  } catch (err) {
    console.warn(`[scheduler] ${job.path} failed:`, err instanceof Error ? err.message : err)
  }
}

/** Start the timers. Returns a stop function for shutdown. */
export function startScheduler(): () => void {
  const origin = appOrigin()
  const secret = process.env.CRON_SECRET?.trim()

  if (!origin || !secret) {
    console.info('[scheduler] PUBLIC_APP_URL or CRON_SECRET unset — interval jobs disabled')
    return () => {}
  }

  const timers = JOBS.map((job) => {
    const timer = setInterval(() => void runOnce(origin, secret, job), job.everyMs)
    // Never hold the process open during a drain.
    timer.unref()
    return timer
  })
  console.info(`[scheduler] driving ${JOBS.length} interval job(s) against ${origin}`)

  return () => timers.forEach((t) => clearInterval(t))
}
