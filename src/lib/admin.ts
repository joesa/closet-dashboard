import { redirect } from 'next/navigation'
import { getSupabaseServer } from './supabase-server'
import { getSupabaseAdmin } from './supabase-admin'

export type AdminUser = {
  id: string
  email: string | null
}

/**
 * Resolve the current admin user from the request cookies.
 *
 * Returns the admin user record if the caller is signed in AND has
 * `profiles.is_admin = true`. Returns null otherwise. Use this from server
 * components / route handlers where you want to gracefully render a 404
 * (e.g. via `notFound()`) instead of redirecting.
 */
export async function getCurrentAdmin(): Promise<AdminUser | null> {
  const supabase = await getSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // Profiles RLS lets a user read their own row, so the anon-bound client
  // is sufficient here. We still double-check with service role below if the
  // policy ever changes (defense-in-depth).
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, email')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.is_admin) {
    return { id: user.id, email: profile.email ?? user.email ?? null }
  }

  // Fallback path: in case RLS hides the row, ask the service role directly.
  const admin = getSupabaseAdmin()
  const { data: viaAdmin } = await admin
    .from('profiles')
    .select('is_admin, email')
    .eq('id', user.id)
    .maybeSingle()

  if (viaAdmin?.is_admin) {
    return { id: user.id, email: viaAdmin.email ?? user.email ?? null }
  }
  return null
}

/**
 * Server-side guard: throws a redirect if the current user isn't an admin.
 * Use at the top of any /admin server component / route handler.
 *
 *   const admin = await requireAdmin()
 */
export async function requireAdmin(): Promise<AdminUser> {
  const me = await getCurrentAdmin()
  if (!me) {
    redirect('/login?next=/admin')
  }
  return me
}

/**
 * Append a row to admin_audit_log. Best-effort: failures are logged but never
 * throw, since the privileged action itself has already succeeded.
 */
export async function logAdminAction(opts: {
  actor: AdminUser
  action: string
  targetType?: string
  targetId?: string
  metadata?: Record<string, unknown>
}) {
  try {
    const admin = getSupabaseAdmin()
    await admin.from('admin_audit_log').insert({
      actor_id: opts.actor.id,
      actor_email: opts.actor.email,
      action: opts.action,
      target_type: opts.targetType ?? null,
      target_id: opts.targetId ?? null,
      metadata: opts.metadata ?? {},
    })
  } catch (err) {
    console.error('[admin] failed to write audit log', err)
  }
}
