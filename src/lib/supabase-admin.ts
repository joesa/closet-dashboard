import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client. BYPASSES RLS. Only safe to use from:
 *   - Stripe webhook handler (writes subscription state)
 *   - Server-side gate checks that need to read billing columns
 *
 * NEVER import this from a client component or pass its results to one.
 */
let _admin: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('supabase-admin must never be used in the browser')
  }
  if (_admin) return _admin

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  _admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return _admin
}
