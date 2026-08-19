import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Return provisioning jobs that died mid-flight to the queue.
 *
 * `processProvisionQueue` only ever selects `status = 'pending'`. If the worker
 * is killed while a job is `processing` — OOM is the documented risk on a
 * memory-capped VM running site builds — the row stays `processing` forever.
 * Graphile's retry re-enters the same function, finds nothing pending, logs a
 * no-op and reports SUCCESS. So a customer's site silently never gets built and
 * every signal says the job finished.
 *
 * The custom-build path already has stale-heartbeat expiry; provisioning did
 * not. This is that, on a schedule.
 */
const STALE_MINUTES = 30
const MAX_ATTEMPTS = 3

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')?.trim()
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const admin = getSupabaseAdmin()
  const cutoff = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString()

  const { data: stuck, error } = await admin
    .from('provision_jobs')
    .select('id, intake_id, attempts, started_at')
    .eq('status', 'processing')
    .lt('started_at', cutoff)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const requeued: string[] = []
  const deadLettered: string[] = []

  for (const job of stuck ?? []) {
    const attempts = (job as { attempts?: number }).attempts ?? 0
    const id = (job as { id: string }).id

    // Past the attempt budget this is not a blip. Park it as needs_review so an
    // admin sees it, rather than cycling a job that will fail the same way.
    if (attempts >= MAX_ATTEMPTS) {
      await admin
        .from('provision_jobs')
        .update({
          status: 'needs_review',
          last_error: `Stalled in processing for over ${STALE_MINUTES} minutes after ${attempts} attempts.`,
          finished_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('status', 'processing')
      deadLettered.push(id)
      continue
    }

    const { data: claimed } = await admin
      .from('provision_jobs')
      .update({
        status: 'pending',
        last_error: `Requeued after stalling in processing for over ${STALE_MINUTES} minutes.`,
      })
      .eq('id', id)
      .eq('status', 'processing')
      .select('id')

    if (claimed && claimed.length > 0) requeued.push(id)
  }

  if (requeued.length > 0 || deadLettered.length > 0) {
    console.warn(
      JSON.stringify({
        event: 'provision_jobs_reaped',
        requeued: requeued.length,
        deadLettered: deadLettered.length,
      })
    )
  }

  return NextResponse.json({ examined: stuck?.length ?? 0, requeued, deadLettered })
}
