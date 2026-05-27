import { createBrowserClient } from '@supabase/ssr'

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
