import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/admin'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

// Admin-only: fetch a full intake by id so the onboarding page can pre-fill
// every captured field before the operator reviews and deploys.
export async function GET(req: Request) {
  const admin = await getCurrentAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = new URL(req.url).searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('prospect_intakes')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: 'Intake not found' }, { status: 404 })
  }

  return NextResponse.json({ intake: data })
}
