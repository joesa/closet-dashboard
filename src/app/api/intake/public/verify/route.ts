import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

function siteOrigin(req: Request): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    new URL(req.url).origin
  )
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')?.trim()
  if (!token) {
    return NextResponse.redirect(`${siteOrigin(req)}/get-started?error=missing_token`)
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('prospect_intakes')
    .select('id, status, source')
    .eq('token', token)
    .maybeSingle()

  const origin = siteOrigin(req)
  if (error || !data) {
    return NextResponse.redirect(`${origin}/get-started?error=invalid_token`)
  }
  if (data.status === 'archived') {
    return NextResponse.redirect(`${origin}/get-started?error=archived`)
  }

  await supabase
    .from('prospect_intakes')
    .update({
      email_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', data.id)

  return NextResponse.redirect(`${origin}/intake/${token}?verified=1`)
}
