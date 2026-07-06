import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// The dashboard (authenticated contractor, RLS-restricted) can't read
// `tenants`/`site_configs` directly — those tables only grant SELECT to
// `anon` (public rendering) and admins (see the 20260601150000 RLS
// migration), not `authenticated`. This route uses the service-role client
// to resolve the signed-in contractor's own `engagement_model` (quote vs
// order — see EngagementModel in catalog/types.ts) so the dashboard can
// decide whether to show the quote-calculator pricing editor or the menu
// items editor.
export async function GET() {
  const supabase = await getSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getSupabaseAdmin()

  // contractor_settings.id doubles as tenants.widget_id (see repo memory).
  const { data: settings } = await admin
    .from('contractor_settings')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!settings) {
    return NextResponse.json({ engagementModel: 'quote' })
  }

  const { data: tenant } = await admin
    .from('tenants')
    .select('id')
    .eq('widget_id', settings.id)
    .maybeSingle()

  if (!tenant) {
    return NextResponse.json({ engagementModel: 'quote' })
  }

  const { data: siteConfig } = await admin
    .from('site_configs')
    .select('engagement_model')
    .eq('tenant_id', tenant.id)
    .maybeSingle()

  return NextResponse.json({
    engagementModel: (siteConfig?.engagement_model as string) || 'quote',
  })
}
