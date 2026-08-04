import { getSupabaseAdmin } from '@/lib/supabase-admin'

export type EnqueueProvisionResult = {
  queued: boolean
  duplicate: boolean
  status?: string
  /** A terminal job was reset to `pending` so this submit deploys again. */
  requeued?: boolean
}

/** Statuses a job can be revived from — nothing is deploying or deployed. */
const TERMINAL_STATUSES = new Set(['failed', 'needs_review', 'cancelled'])

/**
 * Queue the deploy for an intake, at most one job per intake.
 *
 * A row that already exists in `pending`/`processing`/`succeeded` is left alone
 * — that deploy is either in flight or already done. A row in a terminal state
 * is reset to `pending` instead: without that, one failed deploy pinned the
 * intake forever (every resubmit saw "duplicate" and no admin-free path
 * remained), which is the opposite of the unattended flow this feeds.
 */
export async function enqueueProvisionJob(
  intakeId: string,
  mode: 'full' | 'widget' | 'ai_full'
): Promise<EnqueueProvisionResult> {
  const admin = getSupabaseAdmin()
  // Not maybeSingle(): a duplicated row (two submits racing before the unique
  // index existed) made that throw, and the caller then skipped the deploy.
  const { data: existingRows } = await admin
    .from('provision_jobs')
    .select('id, status')
    .eq('intake_id', intakeId)
    .order('created_at', { ascending: false })
    .limit(1)

  const existing = existingRows?.[0]

  if (existing) {
    if (!TERMINAL_STATUSES.has(existing.status)) {
      return { queued: true, duplicate: true, status: existing.status }
    }

    const { error } = await admin
      .from('provision_jobs')
      .update({
        status: 'pending',
        mode,
        attempts: 0,
        last_error: null,
        started_at: null,
        finished_at: null,
      })
      .eq('id', existing.id)

    if (error) throw error
    return { queued: true, duplicate: true, status: 'pending', requeued: true }
  }

  const { error } = await admin.from('provision_jobs').insert({
    intake_id: intakeId,
    status: 'pending',
    mode,
    attempts: 0,
    last_error: null,
    payload: {},
  })

  if (error) throw error
  return { queued: true, duplicate: false }
}
