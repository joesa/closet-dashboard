import type { SupabaseClient } from '@supabase/supabase-js'
import {
  clientLoginUrl,
  generateTempPassword,
} from '@/lib/clientLoginCredentials'

export type ClientLoginCredentials = {
  /** Dashboard login email (username). */
  username: string | null
  /** Initial / last-issued temporary password (may be stale if client reset). */
  password: string | null
  loginUrl: string
  /** True when Auth user exists for this contractor. */
  hasAuthUser: boolean
}

/**
 * Read client dashboard login credentials for admin Engagement tools.
 */
export async function getClientLoginCredentials(
  supabase: SupabaseClient,
  widgetId: string,
  loginOrigin?: string | null
): Promise<ClientLoginCredentials> {
  const { data } = await supabase
    .from('contractor_settings')
    .select('contact_email, initial_login_password, user_id')
    .eq('id', widgetId)
    .maybeSingle()

  const username =
    typeof data?.contact_email === 'string' && data.contact_email.trim()
      ? data.contact_email.trim()
      : null
  const password =
    typeof data?.initial_login_password === 'string' &&
    data.initial_login_password.trim()
      ? data.initial_login_password
      : null

  return {
    username,
    password,
    loginUrl: clientLoginUrl(loginOrigin),
    hasAuthUser: !!data?.user_id,
  }
}

/**
 * Issue a new temporary password for the contractor auth user, store it on
 * contractor_settings, and force password reset on next login.
 */
export async function regenerateClientLoginPassword(
  supabase: SupabaseClient,
  widgetId: string,
  opts?: { loginOrigin?: string | null }
): Promise<ClientLoginCredentials & { regenerated: true }> {
  const { data: settings, error } = await supabase
    .from('contractor_settings')
    .select('contact_email, user_id')
    .eq('id', widgetId)
    .maybeSingle()

  if (error || !settings) {
    throw new Error('Contractor settings not found for this tenant')
  }

  const username =
    typeof settings.contact_email === 'string' && settings.contact_email.trim()
      ? settings.contact_email.trim()
      : null
  if (!username) {
    throw new Error(
      'No contact email on this contractor — set company contact email first.'
    )
  }

  const tempPassword = generateTempPassword()
  let authUserId: string | null =
    typeof settings.user_id === 'string' ? settings.user_id : null

  if (authUserId) {
    const { data: existingAuth } = await supabase.auth.admin.getUserById(authUserId)
    const prevMeta =
      (existingAuth?.user?.user_metadata as Record<string, unknown> | undefined) ||
      {}
    const { error: updateErr } = await supabase.auth.admin.updateUserById(
      authUserId,
      {
        password: tempPassword,
        email: username,
        user_metadata: {
          ...prevMeta,
          force_password_reset: true,
          tenant_id: prevMeta.tenant_id || widgetId,
          widget_id: prevMeta.widget_id || widgetId,
        },
      }
    )
    if (updateErr) {
      throw new Error(`Failed to update auth user: ${updateErr.message}`)
    }
  } else {
    const { data: listed } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    })
    const existing = listed?.users?.find(
      (u) => (u.email || '').toLowerCase() === username.toLowerCase()
    )
    if (existing) {
      authUserId = existing.id
      const { error: updateErr } = await supabase.auth.admin.updateUserById(
        authUserId,
        {
          password: tempPassword,
          user_metadata: {
            force_password_reset: true,
            tenant_id: widgetId,
            widget_id: widgetId,
          },
        }
      )
      if (updateErr) {
        throw new Error(`Failed to update auth user: ${updateErr.message}`)
      }
    } else {
      const { data: created, error: createErr } =
        await supabase.auth.admin.createUser({
          email: username,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            force_password_reset: true,
            tenant_id: widgetId,
            widget_id: widgetId,
          },
        })
      if (createErr) {
        throw new Error(`Failed to create auth user: ${createErr.message}`)
      }
      authUserId = created.user?.id ?? null
    }
  }

  const { error: saveErr } = await supabase
    .from('contractor_settings')
    .update({
      user_id: authUserId,
      contact_email: username,
      initial_login_password: tempPassword,
    })
    .eq('id', widgetId)

  if (saveErr) {
    throw new Error(`Failed to save credentials: ${saveErr.message}`)
  }

  return {
    username,
    password: tempPassword,
    loginUrl: clientLoginUrl(opts?.loginOrigin),
    hasAuthUser: !!authUserId,
    regenerated: true,
  }
}
