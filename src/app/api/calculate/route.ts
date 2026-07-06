import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { corsHeaders, handleOptions } from '@/lib/cors'
import {
  isPricingTier,
  isRoomType,
  normalizeRoomPricing,
  normalizeDomainConfig,
  type PricingTier,
  type RoomPricing,
  type RoomType,
} from '@/lib/rooms'
import { assertEntitled } from '@/lib/gate'
import { DEMO_CONTRACTOR_ID, isAllowedDemoOrigin } from '@/lib/demo'
import { computeQuote } from '@/lib/pricing'
import { checkRateLimit, hashIpForRateLimit } from '@/lib/rate-limit'

export const runtime = 'edge'

// ── Types ──────────────────────────────────────────────────────────

interface CalculateRequest {
  contractorId: string
  // Generic measured quantity. Legacy embedded widgets send `linearFeet`; both
  // are accepted (resolved below) so old bundles keep working after the rename.
  unitQuantity?: number
  linearFeet?: number
  finishType: PricingTier
  // roomType is either a system room name (RoomType) or a contractor-defined
  // custom room name (any string that matches a row in contractor_rooms).
  roomType?: string
  selectedAddOns?: Array<{ id: string, quantity: number }>
  // Legacy field name still sent by older deployed widget bundles. Accepted as
  // a fallback so previously-embedded widgets keep pricing add-ons correctly.
  addOns?: Array<{ id: string, quantity: number }>
}

interface ContractorSettingsRow {
  id: string
  company_name: string
  primary_color_hex: string
  room_pricing: unknown
  domain_config: unknown
  price_drawer: number
  price_shoe_rack: number
}

// ── Helpers ────────────────────────────────────────────────────────

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders })
}

function getPerFootPrice(
  roomPricing: RoomPricing,
  roomType: RoomType,
  finishType: PricingTier
): number {
  return Number(roomPricing[roomType][finishType]) || 0
}

async function hashIp(raw: string): Promise<string | null> {
  if (!raw) return null
  try {
    const buf = new TextEncoder().encode(raw.split(',')[0].trim())
    const digest = await crypto.subtle.digest('SHA-256', buf)
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 32)
  } catch {
    return null
  }
}

// ── CORS preflight ─────────────────────────────────────────────────

export function OPTIONS() {
  return handleOptions()
}

// ── POST handler ───────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CalculateRequest

    // ── Validate input ──
    if (!body.contractorId) {
      return json({ error: 'contractorId is required.' }, 400)
    }

    // ── Demo-account anti-theft (server side) ──
    // The widget's client-side lock is just UX; this is the real check.
    // If someone pastes the demo embed code onto their own domain we
    // refuse to return a quote, so a forked widget.js can't help them.
    if (body.contractorId === DEMO_CONTRACTOR_ID) {
      const origin =
        request.headers.get('origin') ||
        request.headers.get('referer') ||
        ''
      if (!isAllowedDemoOrigin(origin)) {
        return json(
          {
            error: 'demo_restricted',
            message:
              'The ClosetQuote demo widget can only run on closetquotes.com. Sign up for a free 30-day account at https://closet-dashboard-orcin.vercel.app/signup to embed it on your own site.',
          },
          403
        )
      }
    }

    // roomType is optional during the room_pricing rollout for older widgets;
    // default to 'Walk-In Closet' when missing. Accept either a system room or
    // a contractor-defined custom room name (resolved below). Bounded length
    // check guards the public endpoint against abuse via arbitrary strings.
    if (body.roomType !== undefined && typeof body.roomType !== 'string') {
      return json({ error: 'roomType must be a string.' }, 400)
    }
    if (typeof body.roomType === 'string' && body.roomType.length > 120) {
      return json({ error: 'roomType is too long.' }, 400)
    }
    const requestedRoom: string = body.roomType ?? 'Walk-In Closet'

    // Entitlement gate — refuse to quote for expired contractors.
    const blocked = await assertEntitled(body.contractorId)
    if (blocked) return blocked

    const ipForLimit =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('cf-connecting-ip') ||
      ''
    const ipHashLimit = await hashIpForRateLimit(ipForLimit)
    const rateLimit = await checkRateLimit(
      `calculate:${body.contractorId}:${ipHashLimit}`,
      60,
      60
    )
    if (!rateLimit.allowed) {
      return json(
        {
          error: 'rate_limited',
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        429
      )
    }

    // ── Fetch contractor settings from Supabase ──
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: settings, error: dbError } = await supabase
      .from('contractor_settings')
      .select('id, company_name, primary_color_hex, room_pricing, domain_config, price_drawer, price_shoe_rack')
      .eq('id', body.contractorId)
      .single()

    if (dbError || !settings) {
      return json(
        { error: 'Contractor not found. Check the contractorId.' },
        404
      )
    }

    const contractor = settings as ContractorSettingsRow
    const roomPricing = normalizeRoomPricing(contractor.room_pricing)
    const domainConfig = normalizeDomainConfig(contractor.domain_config)

    // Resolve the measured quantity from either the new generic field or the
    // legacy closet field so old embedded widget bundles keep working.
    const rawQuantity = Number(body.unitQuantity ?? body.linearFeet)
    const quantity = Number.isFinite(rawQuantity) && rawQuantity > 0 ? rawQuantity : 1
    const needsQuantity = domainConfig.pricingModel !== 'flat_tiered'
    if (!isPricingTier(body.finishType)) {
      return json(
        { error: "finishType must be 'basic', 'standard', or 'premium'." },
        400
      )
    }
    if (needsQuantity && (!Number.isFinite(rawQuantity) || rawQuantity <= 0)) {
      return json({ error: 'unitQuantity must be a positive number.' }, 400)
    }

    // ── Resolve room (system default OR contractor custom) ──
    let resolvedRoom: string = requestedRoom
    let perFoot = 0
    if (isRoomType(requestedRoom)) {
      perFoot = getPerFootPrice(roomPricing, requestedRoom as RoomType, body.finishType)
    } else {
      const { data: customRoom } = await supabase
        .from('contractor_rooms')
        .select('name, price_basic, price_standard, price_premium')
        .eq('contractor_id', body.contractorId)
        .eq('name', requestedRoom)
        .maybeSingle()
      if (!customRoom) {
        return json({ error: 'Unknown roomType for this contractor.' }, 400)
      }
      resolvedRoom = customRoom.name
      const col = body.finishType === 'basic' ? 'price_basic'
        : body.finishType === 'standard' ? 'price_standard' : 'price_premium'
      perFoot = Number((customRoom as Record<string, unknown>)[col]) || 0
    }

    // ── Fetch contractor addons to calculate total addon cost ──
    const { data: addonsData } = await supabase
      .from('contractor_addons')
      .select('id, price, name')
      .eq('contractor_id', body.contractorId)

    // ── Calculate price ──
    // Accept either `selectedAddOns` (current widget) or `addOns` (older
    // embedded bundles) so add-on pricing works regardless of widget version.
    const requestedAddOns = body.selectedAddOns ?? body.addOns
    const quote = computeQuote({
      pricingModel: domainConfig.pricingModel,
      ratePerUnit: perFoot,
      quantity,
      baseFee: domainConfig.baseFee,
      requestedAddOns,
      addOnCatalog: addonsData,
    })
    const { baseCost, addOnCost, expandedAddOns, estimatedTotal: total } = quote
    const { low, high } = quote.range

    // ── Best-effort telemetry insert ──
    // Records every successful quote calc so admins can see funnel volume.
    // Uses service role to bypass RLS; failures are swallowed.
    try {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (serviceKey) {
        const adminSupa = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceKey,
          { auth: { persistSession: false } }
        )
        const origin =
          request.headers.get('origin') ||
          request.headers.get('referer') ||
          null
        const ipHash = await hashIp(
          request.headers.get('x-forwarded-for') ||
            request.headers.get('cf-connecting-ip') ||
            ''
        )
        await adminSupa.from('quote_events').insert({
          contractor_id: body.contractorId,
          room_type: resolvedRoom,
          finish_type: body.finishType,
          linear_feet: quantity,
          estimated_total: Math.round(total * 100) / 100,
          add_ons_count: expandedAddOns.length,
          source_origin: origin,
          ip_hash: ipHash,
        })
      }
    } catch (telemetryErr) {
      console.error('quote_events insert failed:', telemetryErr)
    }

    return json({
      companyName: contractor.company_name,
      roomType: resolvedRoom,
      finishType: body.finishType,
      // Echo both the generic and legacy field names so new and old widget
      // bundles can each read the quantity they expect.
      unitQuantity: quantity,
      linearFeet: quantity,
      addOns: expandedAddOns,
      pricePerFoot: perFoot,
      baseCost: Math.round(baseCost * 100) / 100,
      addOnCost: Math.round(addOnCost * 100) / 100,
      estimatedTotal: Math.round(total * 100) / 100,
      range: { low, high },
    })
  } catch (error) {
    console.error("API Parsing Error:", error)
    return json({ error: 'Invalid request body or Server Error.' }, 400)
  }
}
