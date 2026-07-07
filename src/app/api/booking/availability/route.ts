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

    // For a real production app, we would also query the bookings table here
    // to filter out slots that are already taken. For this phase, we just return
    // the weekly availability windows and let the frontend generate slots.
    const { data: availability, error: availError } = await supabase
      .from('booking_availability')
      .select('day_of_week, start_time, end_time, slot_duration_minutes')
      .eq('contractor_id', contractorId)
      
    if (availError) {
      console.error('Supabase error fetching availability:', availError)
      return NextResponse.json(
        { error: 'Failed to fetch availability' },
        { status: 500, headers: corsHeaders }
      )
    }

    // Also get existing bookings from today onwards to filter out booked slots
    // Just fetch them and return them so the client can filter.
    const today = new Date().toISOString().split('T')[0]
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('booking_date, booking_time, service_id')
      .eq('contractor_id', contractorId)
      .gte('booking_date', today)
      .neq('status', 'cancelled')

    if (bookingsError) {
      console.error('Supabase error fetching bookings:', bookingsError)
      // Non-fatal, just continue without booked slots filtering
    }

    return NextResponse.json({ 
      availability: availability || [], 
      booked: bookings || []
    }, { headers: corsHeaders })
  } catch (error) {
    console.error('booking availability GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}
