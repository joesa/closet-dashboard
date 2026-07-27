import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { DEMO_LOGIN } from '@/lib/demo'

export function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase()
}

export function isDemoAuthEmail(email: string): boolean {
  return normalizeEmail(email) === DEMO_LOGIN.email.toLowerCase()
}

/** Find Auth user by email via contractor_settings.user_id, else listUsers scan. */
export async function findAuthUserByEmail(email: string): Promise<{
  id: string
  email: string
} | null> {
  const supabase = getSupabaseAdmin()
  const normalized = normalizeEmail(email)
  if (!normalized) return null

  const { data: settings } = await supabase
    .from('contractor_settings')
    .select('user_id, contact_email')
    .ilike('contact_email', normalized)
    .not('user_id', 'is', null)
    .limit(1)
    .maybeSingle()

  if (settings?.user_id) {
    const { data } = await supabase.auth.admin.getUserById(settings.user_id)
    if (data?.user?.email) {
      return { id: data.user.id, email: data.user.email }
    }
  }

  // Paginate a few pages — enough for small/medium user bases.
  for (let page = 1; page <= 5; page++) {
    const { data: listed } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    })
    const hit = listed?.users?.find(
      (u) => (u.email || '').toLowerCase() === normalized
    )
    if (hit?.id && hit.email) {
      return { id: hit.id, email: hit.email }
    }
    if (!listed?.users?.length || listed.users.length < 200) break
  }
  return null
}

export async function findContractorByUserId(userId: string): Promise<{
  id: string
  contact_email: string | null
  email_change_requires_old_ack: boolean
  email_change_previous_email: string | null
} | null> {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('contractor_settings')
    .select(
      'id, contact_email, email_change_requires_old_ack, email_change_previous_email'
    )
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) return null
  return {
    id: data.id,
    contact_email: data.contact_email,
    email_change_requires_old_ack: !!data.email_change_requires_old_ack,
    email_change_previous_email: data.email_change_previous_email,
  }
}

export async function findContractorByContactEmail(email: string): Promise<{
  id: string
  user_id: string | null
  contact_email: string | null
} | null> {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('contractor_settings')
    .select('id, user_id, contact_email')
    .ilike('contact_email', normalizeEmail(email))
    .limit(1)
    .maybeSingle()
  return data || null
}
