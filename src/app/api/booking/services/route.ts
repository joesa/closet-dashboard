import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { corsHeaders, handleOptions } from '@/lib/cors'
import { assertEntitled } from '@/lib/gate'

export const runtime = 'edge'

export { handleOptions as OPTIONS }

/**
 * GET /api/booking/services?contractorId=<uuid>
 * Public read for the BookingEngine. Returns active services from service_catalog.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const contractorId = searchParams.get('contractorId')

    if (!contractorId) {
      return NextResponse.json(
        { error: 'Missing contractorId parameter' },
        { status: 400, headers: corsHeaders }
      )
    }

    const blocked = await assertEntitled(contractorId)
    if (blocked) return blocked

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Server misconfiguration' },
        { status: 500, headers: corsHeaders }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data, error } = await supabase
      .from('service_catalog')
      .select('id, name, description, duration_minutes, price_cents, tier')
      .eq('contractor_id', contractorId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Supabase error fetching services:', error)
      return NextResponse.json(
        { error: 'Failed to fetch services' },
        { status: 500, headers: corsHeaders }
      )
    }

    const services = (data || []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      durationMinutes: row.duration_minutes || 60,
      priceCents: row.price_cents || 0,
      tier: row.tier || 'standard',
    }))

    return NextResponse.json({ services }, { headers: corsHeaders })
  } catch (error) {
    console.error('booking services GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}
