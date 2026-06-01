import { createBrowserClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'

/**
 * Browser-side Supabase client for auth operations.
 *
 * Uses @supabase/ssr's createBrowserClient so the session is stored in
 * cookies (not localStorage). This is required for the server-side `proxy`
 * to see the session and gate /dashboard correctly — otherwise login
 * succeeds client-side but the proxy bounces the user back to /login.
 *
 * Singleton — safe to import from any client component.
 */
export const supabaseBrowser = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function isStaleRefreshError(message: string | undefined): boolean {
  if (!message) return false
  return /refresh token/i.test(message)
}

/** Clear broken auth cookies after a revoked/missing refresh token. */
export async function clearStaleBrowserAuth(): Promise<void> {
  try {
    await supabaseBrowser.auth.signOut({ scope: 'local' })
  } catch {
    /* ignore */
  }
}

/**
 * Validate the current user via Supabase (not just cookie storage).
 * Returns null and clears stale cookies when the refresh token is invalid.
 */
export async function getBrowserUser(): Promise<User | null> {
  try {
    const { data: { user }, error } = await supabaseBrowser.auth.getUser()
    if (error) {
      if (isStaleRefreshError(error.message)) await clearStaleBrowserAuth()
      return null
    }
    return user
  } catch {
    await clearStaleBrowserAuth()
    return null
  }
}
