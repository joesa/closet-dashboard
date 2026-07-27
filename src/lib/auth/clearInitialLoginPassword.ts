import { getSupabaseAdmin } from '@/lib/supabase-admin'

/** Clear stored temp password once the client sets their own. */
export async function clearInitialLoginPassword(opts: {
  userId?: string | null
  contractorId?: string | null
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  if (opts.contractorId) {
    await supabase
      .from('contractor_settings')
      .update({ initial_login_password: null })
      .eq('id', opts.contractorId)
  }
  if (opts.userId) {
    await supabase
      .from('contractor_settings')
      .update({ initial_login_password: null })
      .eq('user_id', opts.userId)
  }
}
