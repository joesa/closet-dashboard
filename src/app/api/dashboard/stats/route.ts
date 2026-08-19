import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { loadContractorStats } from '@/lib/leads/contractorStats'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** The signed-in contractor's own quote/lead numbers, for the dashboard strip. */
export async function GET() {
  const session = await getSupabaseServer()
  const {
    data: { user },
  } = await session.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: settings } = await getSupabaseAdmin()
    .from('contractor_settings')
    .select('id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!settings) return NextResponse.json({ error: 'No contractor profile' }, { status: 404 })

  return NextResponse.json(await loadContractorStats((settings as { id: string }).id))
}
