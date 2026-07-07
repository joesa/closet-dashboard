import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { corsHeaders, handleOptions } from '@/lib/cors'
import { assertEntitled } from '@/lib/gate'

export const runtime = 'edge'

export { handleOptions as OPTIONS }

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

    const today = new Date().toISOString().split('T')[0]
    
    const { data, error } = await supabase
      .from('ticket_events')
      .select('id, name, description, event_date, event_time, venue, capacity, price_cents')
      .eq('contractor_id', contractorId)
      .eq('is_active', true)
      .gte('event_date', today)
      .order('event_date', { ascending: true })

    if (error) {
      console.error('Supabase error fetching events:', error)
      return NextResponse.json(
        { error: 'Failed to fetch events' },
        { status: 500, headers: corsHeaders }
      )
    }

    // In a real app we'd also aggregate ticket_orders to get remaining capacity
    const events = (data || []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      date: row.event_date,
      time: row.event_time || '',
      venue: row.venue || '',
      capacity: row.capacity || null,
      priceCents: row.price_cents || 0,
    }))

    return NextResponse.json({ events }, { headers: corsHeaders })
  } catch (error) {
    console.error('ticket events GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}
