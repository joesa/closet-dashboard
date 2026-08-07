import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { loadOwnedSiteContent } from '@/lib/site-content/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const loaded = await loadOwnedSiteContent()
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status })
  const { data, error } = await getSupabaseAdmin()
    .from('site_content_revisions')
    .select('id, version, changed_paths, created_at')
    .eq('tenant_id', loaded.value.tenantId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    revisions: (data || []).map((row) => ({
      id: row.id,
      version: Number(row.version),
      changedPaths: row.changed_paths || [],
      createdAt: row.created_at,
    })),
  })
}

