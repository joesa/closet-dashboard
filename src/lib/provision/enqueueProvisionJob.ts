import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function enqueueProvisionJob(intakeId: string, mode: 'full' | 'widget') {
  const admin = getSupabaseAdmin()
  const { data: existing } = await admin
    .from('provision_jobs')
    .select('id, status')
    .eq('intake_id', intakeId)
    .maybeSingle()

  if (existing) {
    return { queued: true, duplicate: true, status: existing.status }
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
