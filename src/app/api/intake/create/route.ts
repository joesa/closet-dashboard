import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getCurrentAdmin } from '@/lib/admin'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

// Admin-only: create a draft intake + shareable token. The admin sends the
// returned URL to the prospect, who fills in the build/setup details.
export async function POST(req: Request) {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const businessName: string | undefined = body.businessName
    const scraperLeadId: string | undefined = body.scraperLeadId

    const token = randomUUID().replace(/-/g, '')
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase
      .from('prospect_intakes')
      .insert({
        token,
        status: 'draft',
        business_name: businessName || null,
        scraper_lead_id: scraperLeadId || null,
      })
      .select('id, token')
      .single()

    if (error) throw error

    const origin = new URL(req.url).origin
    return NextResponse.json({
      success: true,
      id: data.id,
      token: data.token,
      url: `${origin}/intake/${data.token}`,
    })
  } catch (error) {
    console.error('Intake create error:', error)
    const message = error instanceof Error ? error.message : 'Failed to create intake link'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
