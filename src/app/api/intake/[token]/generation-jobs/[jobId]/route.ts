import { NextResponse } from 'next/server'
import { getIntakeByToken } from '@/lib/intake/getIntakeByToken'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string; jobId: string }> }
) {
  const { token, jobId } = await params
  const intake = await getIntakeByToken(token)
  if (!intake) return NextResponse.json({ error: 'Intake not found' }, { status: 404 })

  const { data, error } = await getSupabaseAdmin()
    .from('intake_generation_jobs')
    .select('id, operation, status, result, error, created_at, started_at, finished_at')
    .eq('id', jobId)
    .eq('intake_id', intake.id)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: 'Generation job not found' }, { status: 404 })
  }
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
}
