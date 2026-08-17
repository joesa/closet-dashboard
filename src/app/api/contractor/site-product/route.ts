import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Does this contractor have a hosted site, or only the widget?
 *
 * The dashboard is one page shared by both products and has never known which
 * one it is looking at, so widget-only customers get an "Edit Website" button,
 * a Website Content Studio card and a domain manager that all resolve to
 * "No hosted website found for this account" — the 404 from
 * resolveContractorTenantId, which filters `site_status = 'widget_only'`.
 *
 * `tenants` is not readable from the browser under RLS, so the answer comes
 * from here rather than a client query. Absence of a tenant row (self-serve
 * widget signups never create one) is the same answer as widget_only.
 */
export async function GET() {
  const session = await getSupabaseServer()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const { data: settings } = await supabase
    .from('contractor_settings')
    .select('id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!settings) {
    return NextResponse.json({ hasHostedSite: false, siteStatus: null })
  }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('site_status')
    .eq('id', settings.id)
    .maybeSingle()

  const siteStatus = (tenant?.site_status as string | undefined) ?? null
  return NextResponse.json({
    hasHostedSite: !!siteStatus && siteStatus !== 'widget_only',
    siteStatus,
  })
}
