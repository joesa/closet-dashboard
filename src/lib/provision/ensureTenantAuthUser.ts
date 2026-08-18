import type { SupabaseClient } from '@supabase/supabase-js'
import { generateStrongPassword } from '@/lib/generateStrongPassword'

/**
 * Create (or reset) the login for a tenant owner, and wire it to their
 * contractor_settings row.
 *
 * Shared by provisioning and spec-build adoption. Adoption exists precisely
 * because a spec build provisions with `createAuthUser: false` — nobody gets an
 * account for a site they never asked for — so the account has to be created
 * later, at the moment they say yes, and it must be created exactly the way
 * provisioning would have. Two copies of this drifting apart would mean an
 * adopted customer's login worked slightly differently from everyone else's.
 */
export type EnsureAuthUserResult = {
  authUserId: string | null
  tempPassword: string
  created: boolean
}

/**
 * The real initial dashboard password for a provisioned contractor.
 *
 * This used to be built from `Math.random()`, which is a seeded xorshift128+
 * whose internal state is recoverable from a few observed outputs — and a
 * single serverless instance provisions several tenants in a row, so one
 * emailed password could be used to predict its neighbours. `crypto`-backed
 * generation already existed one directory away and simply was not wired in.
 */
export function generateTempPassword(): string {
  return `Dtf-${generateStrongPassword(16)}`
}

export async function ensureTenantAuthUser(
  supabase: SupabaseClient,
  opts: {
    ownerEmail: string
    tenantId: string
    widgetId: string
    tempPassword?: string
  }
): Promise<EnsureAuthUserResult> {
  const tempPassword = opts.tempPassword ?? generateTempPassword()
  const metadata = {
    force_password_reset: true,
    tenant_id: opts.tenantId,
    widget_id: opts.widgetId,
  }

  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  const existing = existingUsers.users.find((u) => u.email === opts.ownerEmail)

  let authUserId: string | null = null
  let created = false

  if (existing) {
    authUserId = existing.id
    await supabase.auth.admin.updateUserById(existing.id, {
      password: tempPassword,
      user_metadata: metadata,
    })
  } else {
    const { data: madeUser, error } = await supabase.auth.admin.createUser({
      email: opts.ownerEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: metadata,
    })
    if (error) console.error('Failed to create auth user:', error)
    else {
      authUserId = madeUser.user?.id ?? null
      created = true
    }
  }

  if (authUserId) {
    await supabase
      .from('contractor_settings')
      .update({
        user_id: authUserId,
        contact_email: opts.ownerEmail,
        initial_login_password: tempPassword,
      })
      .eq('id', opts.tenantId)
  }

  return { authUserId, tempPassword, created }
}
