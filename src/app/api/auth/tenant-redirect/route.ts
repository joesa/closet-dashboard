import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { getTenantHostnameForUser, isDashboardHost } from '@/lib/tenantHost'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/tenant-redirect?next=/dashboard
 *
 * Resolves the signed-in user's own site hostname (e.g.
 * sotoy-parking-services.ditchtheform.com) so the login page can send them
 * back to their own subdomain after authenticating, instead of leaving them
 * on the shared dashboard host. Always derives the tenant from the
 * authenticated session — never from a client-supplied hostname — so a user
 * can never be redirected into someone else's site.
 */
export async function GET(req: Request) {
  const supabase = await getSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ url: null })
  }

  // Only accept a same-site, single-slash path — reject absolute URLs and
  // protocol-relative "//host" paths, which browsers treat as a redirect to
  // an arbitrary external host.
  const next = new URL(req.url).searchParams.get('next') || '/dashboard'
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'

  const hostname = await getTenantHostnameForUser(user.id)
  if (!hostname || isDashboardHost(hostname)) {
    return NextResponse.json({ url: null })
  }

  return NextResponse.json({ url: `https://${hostname}${safeNext}` })
}
