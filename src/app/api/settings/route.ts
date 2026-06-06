import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { corsHeaders, handleOptions } from '@/lib/cors'
import { normalizeRoomPricing } from '@/lib/rooms'
import { assertEntitled } from '@/lib/gate'

export const runtime = 'edge'

// Handle OPTIONS requests for CORS preflight
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

    // Entitlement gate — contractor must be in trial or on an active plan.
    const blocked = await assertEntitled(contractorId)
    if (blocked) return blocked

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase environment variables')
      return NextResponse.json(
        { error: 'Server misconfiguration' },
        { status: 500, headers: corsHeaders }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data, error } = await supabase
      .from('contractor_settings')
      // Selecting brand fields + pricing fields so the widget has everything it needs.
      // price_per_ft_* are DEPRECATED; kept in the response during the room_pricing
      // rollout for older widget builds and will be removed in a follow-up.
      .select('company_name, primary_color_hex, price_per_ft_basic, price_per_ft_standard, price_per_ft_premium, price_drawer, price_shoe_rack, room_pricing, disabled_default_rooms, disabled_default_finishes, tier_names')
      .eq('id', contractorId)
      .maybeSingle()

    if (error) {
      console.error('Supabase error fetching settings:', error)
      return NextResponse.json(
        { error: 'Failed to fetch settings' },
        { status: 500, headers: corsHeaders }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Settings not found for this contractor' },
        { status: 404, headers: corsHeaders }
      )
    }

    // Fetch custom addons
    const { data: addonsData } = await supabase
      .from('contractor_addons')
      .select('id, room_type, name, price')
      .eq('contractor_id', contractorId)
      .order('created_at', { ascending: true })

    // Fetch contractor-defined custom rooms
    const { data: roomsData } = await supabase
      .from('contractor_rooms')
      .select('id, name, price_basic, price_standard, price_premium')
      .eq('contractor_id', contractorId)
      .order('created_at', { ascending: true })

    // Fetch contractor-defined custom finishes (material colors)
    const { data: finishesData } = await supabase
      .from('contractor_finishes')
      .select('id, label, description, swatch_hex, tier, sort_order')
      .eq('contractor_id', contractorId)
      .order('sort_order', { ascending: true })

    const tierNamesRaw = data.tier_names as
      | { basic?: string; standard?: string; premium?: string }
      | null
    const tierNames = {
      basic: tierNamesRaw?.basic || 'Basic',
      standard: tierNamesRaw?.standard || 'Standard',
      premium: tierNamesRaw?.premium || 'Premium',
    }

    const responsePayload = {
      companyName: data.company_name,
      primaryColorHex: data.primary_color_hex,
      tierNames,
      // DEPRECATED: legacy global tiers, kept for older widget builds.
      pricePerFtBasic: data.price_per_ft_basic,
      pricePerFtStandard: data.price_per_ft_standard,
      pricePerFtPremium: data.price_per_ft_premium,
      // Room-specific pricing matrix. Widgets should prefer this.
      roomPricing: normalizeRoomPricing(data.room_pricing),
      // Contractor-defined rooms (in addition to the system defaults in roomPricing).
      customRooms: (roomsData || []).map((r) => ({
        id: r.id,
        name: r.name,
        basic: Number(r.price_basic) || 0,
        standard: Number(r.price_standard) || 0,
        premium: Number(r.price_premium) || 0,
      })),
      // Contractor-defined material colors. tier maps to the per-foot pricing.
      customFinishes: (finishesData || []).map((f) => ({
        id: f.id,
        label: f.label,
        description: f.description,
        swatchHex: f.swatch_hex,
        tier: f.tier,
      })),
      // System defaults the contractor has hidden from their widget.
      disabledDefaultRooms: (data.disabled_default_rooms as string[] | null) || [],
      disabledDefaultFinishes: (data.disabled_default_finishes as string[] | null) || [],
      addOns: (addonsData || []).map(addon => ({
        id: addon.id,
        roomType: addon.room_type,
        name: addon.name,
        price: addon.price
      }))
    }

    return NextResponse.json(responsePayload, {
      status: 200,
      headers: corsHeaders,
    })
  } catch (err) {
    console.error('Error in settings route:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}
