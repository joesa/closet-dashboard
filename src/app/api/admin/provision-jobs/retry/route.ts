import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/admin'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: Request) {
  const adminUser = await getCurrentAdmin()
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const jobId = typeof body.jobId === 'string' ? body.jobId : ''
  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('provision_jobs')
    .update({
      status: 'pending',
      last_error: null,
      started_at: null,
      finished_at: null,
    })
    .eq('id', jobId)
    .in('status', ['failed', 'needs_review'])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
