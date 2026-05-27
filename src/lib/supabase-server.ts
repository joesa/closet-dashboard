import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Server-side Supabase client bound to the request cookies. Use from server
 * components, route handlers, and server actions to read the current user's
 * session and run RLS-scoped queries on their behalf.
 *
 * For middleware, use the variant in `src/middleware.ts` directly — it needs
 * access to both the request and response cookie jars.
 */
export async function getSupabaseServer() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: CookieOptions }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // `set` throws in pure Server Components; middleware refreshes the
            // session cookies so this can be safely ignored here.
          }
        },
      },
    }
  )
}
