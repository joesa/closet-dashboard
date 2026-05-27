import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { DEMO_LOGIN } from '@/lib/demo'

// Run on Node — uses service-role client. Vercel cron will hit this on
// the schedule defined in /vercel.json. The Vercel platform attaches an
// `Authorization: Bearer ${CRON_SECRET}` header automatically when a
// cron job invokes a project route; we verify it here to keep the
// endpoint from being abused via a public POST.
export const runtime = 'nodejs'

const DEMO_ROOM_PRICING = {
  'Walk-In Closet':       { basic: 45, standard: 75,  premium: 140 },
  'Reach-In Closet':      { basic: 35, standard: 55,  premium: 95 },
  'Garage':               { basic: 70, standard: 110, premium: 180 },
  'Pantry & Wine':        { basic: 30, standard: 50,  premium: 90 },
  'Home Office':          { basic: 60, standard: 90,  premium: 150 },
  'Laundry Room':         { basic: 40, standard: 65,  premium: 100 },
  'Mudroom':              { basic: 45, standard: 70,  premium: 115 },
  'Entertainment Center': { basic: 80, standard: 120, premium: 200 },
  'Wall Beds':            { basic: 90, standard: 130, premium: 210 },
  'Craft Room':           { basic: 35, standard: 60,  premium: 95 },
  'Home Library':         { basic: 75, standard: 115, premium: 185 },
  'Kid Spaces':           { basic: 30, standard: 45,  premium: 80 },
  'Dressing Room':        { basic: 65, standard: 100, premium: 160 },
  'Home Storage':         { basic: 40, standard: 65,  premium: 105 },
} as const

const DEMO_FINISHES: Array<{
  label: string
  description: string
  swatch_hex: string
  tier: 'basic' | 'standard' | 'premium'
  sort_order: number
}> = [
  { label: 'High-Gloss Acrylic', description: 'Mirror-finish lacquer, ultra-modern',    swatch_hex: '#f8fafc', tier: 'premium',  sort_order: 1 },
  { label: 'Walnut Veneer',      description: 'Real-wood veneer, rich grain',           swatch_hex: '#5c3a21', tier: 'premium',  sort_order: 2 },
  { label: 'Brushed Oak',        description: 'Warm matte oak with soft brushed grain', swatch_hex: '#b08868', tier: 'standard', sort_order: 3 },
  { label: 'Charcoal Linen',     description: 'Textured charcoal, low-sheen',           swatch_hex: '#3f3f46', tier: 'standard', sort_order: 4 },
  { label: 'Soft White Matte',   description: 'Designer matte white, no glare',         swatch_hex: '#f3f4f6', tier: 'basic',    sort_order: 5 },
  { label: 'Greige Woodgrain',   description: 'Warm greige with light woodgrain',       swatch_hex: '#a8a29e', tier: 'basic',    sort_order: 6 },
]

const DEMO_ADDONS: Array<{ name: string; price: number; room_type: string }> = [
  { name: 'Soft-Close Drawer',              price: 145, room_type: 'all' },
  { name: 'Velvet Jewelry Tray',            price: 85,  room_type: 'all' },
  { name: 'Pull-Out Shoe Rack',             price: 120, room_type: 'all' },
  { name: 'LED Lighting (per shelf)',       price: 65,  room_type: 'all' },
  { name: 'Pull-Down Closet Rod',           price: 180, room_type: 'all' },
  { name: 'Tie & Belt Rack',                price: 55,  room_type: 'all' },
  { name: 'Hamper Insert',                  price: 110, room_type: 'all' },
  { name: 'Glass Display Door',             price: 225, room_type: 'all' },
  { name: 'Crown Molding Trim',             price: 140, room_type: 'all' },
  { name: 'Pull-Out Valet Rod',             price: 75,  room_type: 'all' },
  { name: 'Garage Epoxy Floor (per sqft)',  price: 9,   room_type: 'all' },
  { name: 'Slatwall Panel',                 price: 165, room_type: 'all' },
  { name: 'Overhead Storage Rack',          price: 295, room_type: 'all' },
  { name: 'Workbench Module',               price: 450, room_type: 'all' },
  { name: 'Cable Management Channel',       price: 45,  room_type: 'all' },
  { name: 'File Drawer with Lock',          price: 195, room_type: 'all' },
  { name: 'Wine Bottle Rack (12-bottle)',   price: 175, room_type: 'all' },
  { name: 'Spice Drawer Insert',            price: 85,  room_type: 'all' },
]

const DEMO_CUSTOM_ROOMS: Array<{
  name: string
  price_basic: number
  price_standard: number
  price_premium: number
}> = [
  { name: 'Boat / RV Storage', price_basic: 55, price_standard: 85, price_premium: 140 },
  { name: 'Hobby Workshop',    price_basic: 50, price_standard: 80, price_premium: 135 },
]

function unauthorized() {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
}

async function reseed() {
  const demoId = process.env.DEMO_CONTRACTOR_ID?.trim()
  if (!demoId) {
    return NextResponse.json(
      { error: 'DEMO_CONTRACTOR_ID env var is not configured.' },
      { status: 500 }
    )
  }

  const admin = getSupabaseAdmin()

  // 1) Reset contractor_settings row (room_pricing matrix + basics).
  const { error: settingsErr, data: settingsRow } = await admin
    .from('contractor_settings')
    .update({
      company_name: 'ClosetQuote Demo Co.',
      primary_color_hex: '#0f172a',
      price_drawer: 95,
      price_shoe_rack: 60,
      room_pricing: DEMO_ROOM_PRICING,
      disabled_default_rooms: [],
      disabled_default_finishes: [],
    })
    .eq('id', demoId)
    .select('id')
    .single()

  if (settingsErr || !settingsRow) {
    return NextResponse.json(
      { error: 'Failed to reset contractor_settings', details: settingsErr?.message ?? 'no row' },
      { status: 500 }
    )
  }

  // 2) Wipe + reinsert custom finishes.
  await admin.from('contractor_finishes').delete().eq('contractor_id', demoId)
  const { error: finishesErr } = await admin.from('contractor_finishes').insert(
    DEMO_FINISHES.map((f) => ({ ...f, contractor_id: demoId }))
  )
  if (finishesErr) {
    return NextResponse.json(
      { error: 'Failed to reseed finishes', details: finishesErr.message },
      { status: 500 }
    )
  }

  // 3) Wipe + reinsert add-ons.
  await admin.from('contractor_addons').delete().eq('contractor_id', demoId)
  const { error: addonsErr } = await admin.from('contractor_addons').insert(
    DEMO_ADDONS.map((a) => ({ ...a, contractor_id: demoId }))
  )
  if (addonsErr) {
    return NextResponse.json(
      { error: 'Failed to reseed addons', details: addonsErr.message },
      { status: 500 }
    )
  }

  // 4) Wipe + reinsert custom rooms.
  await admin.from('contractor_rooms').delete().eq('contractor_id', demoId)
  const { error: roomsErr } = await admin.from('contractor_rooms').insert(
    DEMO_CUSTOM_ROOMS.map((r) => ({ ...r, contractor_id: demoId }))
  )
  if (roomsErr) {
    return NextResponse.json(
      { error: 'Failed to reseed rooms', details: roomsErr.message },
      { status: 500 }
    )
  }

  // 5) Reset the demo auth user's password so leaked / changed passwords
  //    snap back to the published default every night. Looked up by email
  //    because the auth user id may not match the contractor_settings id.
  let passwordReset: 'ok' | 'skipped' | 'error' = 'skipped'
  let passwordError: string | undefined
  try {
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    })
    if (listErr) throw listErr
    const demoUser = list?.users?.find(
      (u) => u.email?.toLowerCase() === DEMO_LOGIN.email.toLowerCase()
    )
    if (demoUser) {
      const { error: updErr } = await admin.auth.admin.updateUserById(demoUser.id, {
        password: DEMO_LOGIN.password,
        email_confirm: true,
      })
      if (updErr) throw updErr
      passwordReset = 'ok'
    }
  } catch (err) {
    passwordReset = 'error'
    passwordError = err instanceof Error ? err.message : String(err)
  }

  return NextResponse.json({
    ok: true,
    demoId,
    counts: {
      finishes: DEMO_FINISHES.length,
      addons: DEMO_ADDONS.length,
      customRooms: DEMO_CUSTOM_ROOMS.length,
    },
    passwordReset,
    passwordError,
    resetAt: new Date().toISOString(),
  })
}

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  const header = request.headers.get('authorization') || ''
  return header === `Bearer ${secret}`
}

// Vercel cron invokes routes with GET by default.
export async function GET(request: Request) {
  if (!isAuthorized(request)) return unauthorized()
  return reseed()
}

// Allow manual POST runs (e.g. curl from the operator) with the same secret.
export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorized()
  return reseed()
}
