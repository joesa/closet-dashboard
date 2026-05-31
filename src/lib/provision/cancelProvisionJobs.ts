import { getSupabaseAdmin } from '@/lib/supabase-admin'

/** Stop auto-build for an intake held for manual AI provisioning. */
export async function cancelPendingProvisionJobs(intakeId: string) {
  const admin = getSupabaseAdmin()

  await admin
    .from('provision_jobs')
    .delete()
    .eq('intake_id', intakeId)
    .eq('status', 'pending')

  await admin
    .from('provision_jobs')
    .update({
      status: 'needs_review',
      last_error: 'Held for manual AI build',
      finished_at: new Date().toISOString(),
    })
    .eq('intake_id', intakeId)
    .eq('status', 'processing')
}
