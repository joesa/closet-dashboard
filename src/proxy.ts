import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Edge middleware enforcing two gates:
 *   1. Auth gate    — must be signed in to access /dashboard.
 *   2. Trial gate   — must be on an active subscription OR still inside the
 *                     30-day trial window. Otherwise redirect to /billing.
 *
 * Also refreshes the Supabase auth cookies on every navigation (standard
 * @supabase/ssr pattern). The matcher below scopes this strictly to the
 * routes we care about so we don't add latency to the landing page.
 */
export async function proxy(req: NextRequest) {
  let res = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          res = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: per @supabase/ssr docs, this must be the first auth call so
  // the cookie refresh runs reliably. A stale/missing refresh token throws
  // an AuthApiError here; sign out locally so bad cookies don't linger.
  let user: { id: string } | null = null
  try {
    const { data, error } = await supabase.auth.getUser()
    if (error) {
      // Local scope only — don't hit the Auth API again with a dead refresh token.
      await supabase.auth.signOut({ scope: 'local' })
    } else {
      user = data.user
    }
  } catch {
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch {
      /* ignore */
    }
    user = null
  }

  const url = req.nextUrl
  const path = url.pathname

  // Dashboard requires auth + entitlement.
  if (path.startsWith('/dashboard')) {
    if (!user) {
      const redirectUrl = url.clone()
      redirectUrl.pathname = '/login'
      redirectUrl.searchParams.set('next', path)
      return NextResponse.redirect(redirectUrl)
    }

    // Use the RLS-bypassing entitlement() function so we don't depend on the
    // user's read policy for billing columns.
    const { data: entitled } = await supabase.rpc('entitlement', {
      p_user_id: user.id,
    })

    if (entitled !== true) {
      const redirectUrl = url.clone()
      redirectUrl.pathname = '/billing'
      redirectUrl.searchParams.set('reason', 'trial_expired')
      return NextResponse.redirect(redirectUrl)
    }
  }

  // /admin requires auth + admin flag on the profile row.
  if (path.startsWith('/admin')) {
    if (!user) {
      const redirectUrl = url.clone()
      redirectUrl.pathname = '/login'
      redirectUrl.searchParams.set('next', path)
      return NextResponse.redirect(redirectUrl)
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile?.is_admin) {
      // Not an admin → bounce to the regular dashboard. We intentionally do
      // not reveal the existence of /admin to non-admins.
      const redirectUrl = url.clone()
      redirectUrl.pathname = '/dashboard'
      return NextResponse.redirect(redirectUrl)
    }
  }

  // /billing requires auth (so we know who to charge), but NOT entitlement.
  if (path === '/billing' && !user) {
    const redirectUrl = url.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('next', '/billing')
    return NextResponse.redirect(redirectUrl)
  }

  return res
}

export const config = {
  matcher: ['/dashboard/:path*', '/billing', '/admin/:path*'],
}
