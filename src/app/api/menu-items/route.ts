import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { corsHeaders, handleOptions } from '@/lib/cors'
import { assertEntitled } from '@/lib/gate'

export const runtime = 'edge'

// Handle OPTIONS requests for CORS preflight
export { handleOptions as OPTIONS }

/**
 * GET /api/menu-items?contractorId=<uuid>
 * Public read for the <closet-order-widget> — the menu/catalog analog of
 * /api/settings' custom-rooms fetch. Returns available menu items grouped
 * implicitly by `category`, sorted for stable display.
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

    // Entitlement gate — same as /api/settings, keeps this consistent with
    // every other widget-facing endpoint (expired accounts stop serving).
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
      .from('menu_items')
      .select('id, name, description, price, category, image_url, available, sort_order')
      .eq('contractor_id', contractorId)
      .eq('available', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Supabase error fetching menu items:', error)
      return NextResponse.json(
        { error: 'Failed to fetch menu items' },
        { status: 500, headers: corsHeaders }
      )
    }

    const items = (data || []).map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      price: Number(row.price) || 0,
      category: row.category || 'Menu',
      imageUrl: row.image_url || null,
    }))

    return NextResponse.json({ items }, { headers: corsHeaders })
  } catch (error) {
    console.error('menu-items GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}
