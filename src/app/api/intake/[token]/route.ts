import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { checkRateLimit, hashRateKey } from '@/lib/rateLimit'
import { enqueueProvisionJob } from '@/lib/provision/enqueueProvisionJob'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('prospect_intakes')
    .select('business_name, status, source, email_verified_at, requested_product')
    .eq('token', token)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: 'Intake not found' }, { status: 404 })
  }
  if (data.status === 'archived') {
    return NextResponse.json({ error: 'This intake link is no longer active' }, { status: 410 })
  }

  return NextResponse.json({
    businessName: data.business_name,
    status: data.status,
    alreadySubmitted: data.status !== 'draft',
    source: data.source,
    emailVerified: !!data.email_verified_at,
    requestedProduct: data.requested_product,
  })
}

function decodeDataUrl(dataUrl: string): { ext: string; mime: string; buffer: Buffer } | null {
  const match = /^data:(image\/(png|jpeg|jpg|webp|svg\+xml));base64,(.+)$/i.exec(dataUrl)
  if (!match) return null
  const mime = match[1]
  const extMap: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  }
  return { ext: extMap[mime] || 'png', mime, buffer: Buffer.from(match[3], 'base64') }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await req.json()
    const supabase = getSupabaseAdmin()

    const submitLimit = await checkRateLimit(
      hashRateKey('intake_submit', token),
      3,
      60 * 60 * 1000
    )
    if (!submitLimit.allowed) {
      return NextResponse.json({ error: 'Too many submit attempts.' }, { status: 429 })
    }

    const { data: existing, error: findErr } = await supabase
      .from('prospect_intakes')
      .select('id, status, source, email_verified_at, requested_product')
      .eq('token', token)
      .maybeSingle()

    if (findErr || !existing) {
      return NextResponse.json({ error: 'Intake not found' }, { status: 404 })
    }
    if (existing.status === 'archived') {
      return NextResponse.json({ error: 'This intake link is no longer active' }, { status: 410 })
    }

    if (existing.source === 'public' && !existing.email_verified_at) {
      return NextResponse.json(
        {
          error:
            'Please verify your email using the link we sent before submitting this form.',
        },
        { status: 403 }
      )
    }

    let logoUrl: string | null = null
    if (typeof body.logoDataUrl === 'string' && body.logoDataUrl.startsWith('data:')) {
      const decoded = decodeDataUrl(body.logoDataUrl)
      if (!decoded) {
        return NextResponse.json({ error: 'Unsupported logo format' }, { status: 400 })
      }
      if (decoded.buffer.byteLength > 3 * 1024 * 1024) {
        return NextResponse.json({ error: 'Logo too large (max 3MB)' }, { status: 400 })
      }
      const path = `intakes/${token}/logo.${decoded.ext}`
      const { error: upErr } = await supabase.storage
        .from('site-assets')
        .upload(path, decoded.buffer, { contentType: decoded.mime, upsert: true })
      if (upErr) throw upErr
      logoUrl = supabase.storage.from('site-assets').getPublicUrl(path).data.publicUrl
    }

    const toStr = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
    const toArr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [])

    const requestedProduct =
      body.requestedProduct === 'widget' || body.requestedProduct === 'full'
        ? body.requestedProduct
        : existing.requested_product

    const update: Record<string, unknown> = {
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      business_name: toStr(body.businessName),
      contact_name: toStr(body.contactName),
      contact_email: toStr(body.contactEmail),
      contact_phone: toStr(body.contactPhone),
      street_address: toStr(body.streetAddress),
      address_locality: toStr(body.addressLocality),
      address_region: toStr(body.addressRegion),
      postal_code: toStr(body.postalCode),
      service_area: toStr(body.serviceArea),
      notification_email: toStr(body.notificationEmail) || toStr(body.contactEmail),
      notification_phone: toStr(body.notificationPhone) || toStr(body.contactPhone),
      services: toArr(body.services),
      pricing_notes: toStr(body.pricingNotes),
      primary_color_hex: toStr(body.primaryColorHex),
      vibe: toStr(body.vibe),
      tone: toStr(body.tone),
      customers: toStr(body.customers),
      experience: toStr(body.experience),
      differentiators: toArr(body.differentiators),
      primary_cta: toStr(body.primaryCta),
      desired_domain: toStr(body.desiredDomain),
      notes: toStr(body.notes),
      requested_product: requestedProduct,
    }
    if (logoUrl) update.logo_url = logoUrl

    const { error: updateErr } = await supabase
      .from('prospect_intakes')
      .update(update)
      .eq('id', existing.id)

    if (updateErr) throw updateErr

    const mode = requestedProduct === 'widget' ? 'widget' : 'full'
    await enqueueProvisionJob(existing.id, mode)

    return NextResponse.json({ success: true, provisionQueued: true })
  } catch (error) {
    console.error('Intake submit error:', error)
    const message = error instanceof Error ? error.message : 'Failed to submit intake'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
