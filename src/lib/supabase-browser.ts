import { createBrowserClient } from '@supabase/ssr'
import type { Session, User } from '@supabase/supabase-js'

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
  return /refresh token|session.*not found|invalid.*jwt|timeout/i.test(message)
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Clear broken auth cookies after a revoked/missing refresh token. */
export async function clearStaleBrowserAuth(): Promise<void> {
  try {
    await withTimeout(
      supabaseBrowser.auth.signOut({ scope: 'local' }),
      2000
    )
  } catch {
    /* ignore — cookies may already be gone or lock timed out */
  }
}

/**
 * Sign out without freezing the UI. Local cookie clear only — never await a
 * global Auth revoke (that path hangs when the refresh token is already dead
 * and can deadlock the Supabase auth lock on the next page load).
 */
export async function signOutBrowser(): Promise<void> {
  await clearStaleBrowserAuth()
}

/**
 * Fast, network-free session read for marketing chrome (Sign In vs Sign Out).
 * Does not call getUser / refresh — safe on the public landing page.
 */
export async function getBrowserSession(): Promise<Session | null> {
  try {
    const { data } = await withTimeout(
      supabaseBrowser.auth.getSession(),
      2000
    )
    return data.session ?? null
  } catch {
    return null
  }
}

/**
 * Validate the current user via Supabase (not just cookie storage).
 * Returns null and clears stale cookies when the refresh token is invalid.
 * Times out so a hung Auth lock cannot freeze the tab.
 */
export async function getBrowserUser(): Promise<User | null> {
  try {
    // Skip the network round-trip when there is no local session.
    const session = await getBrowserSession()
    if (!session) return null

    const { data, error } = await withTimeout(
      supabaseBrowser.auth.getUser(),
      4000
    )
    if (error) {
      if (isStaleRefreshError(error.message)) await clearStaleBrowserAuth()
      return null
    }
    return data.user
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (isStaleRefreshError(msg)) await clearStaleBrowserAuth()
    return null
  }
}
