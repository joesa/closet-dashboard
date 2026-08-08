import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { corsHeaders, handleOptions } from '@/lib/cors'
import { assertEntitled } from '@/lib/gate'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { checkRateLimit, hashIpForRateLimit } from '@/lib/rate-limit'

import { platformFromEmail } from '@/lib/fromEmail'
import { sendSms } from '@/lib/twilio-sms'
import { splitName } from '@/lib/nameUtils'

export const runtime = 'edge'

interface BookingRequest {
  contractorId?: string
  serviceId?: string
  date?: string
  time?: string
  name?: string
  email?: string
  phone?: string
  notes?: string
}

const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: corsHeaders })

export function OPTIONS() {
  return handleOptions()
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BookingRequest
    const {
      contractorId, serviceId,
      date, time, name, email, phone, notes
    } = body

    if (!contractorId) return json({ error: 'contractorId is required.' }, 400)
    if (!name || !email) return json({ error: 'name and email are required.' }, 400)
    if (!date || !time) return json({ error: 'date and time are required.' }, 400)
    if (!serviceId) return json({ error: 'serviceId is required.' }, 400)

    const blocked = await assertEntitled(contractorId)
    if (blocked) return blocked

    const ipForLimit = request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || ''
    const ipHashLimit = await hashIpForRateLimit(ipForLimit)
    const rateLimit = await checkRateLimit(`send-booking:${contractorId}:${ipHashLimit}`, 10, 60)
    if (!rateLimit.allowed) {
      return json({ error: 'rate_limited', retryAfterSeconds: rateLimit.retryAfterSeconds }, 429)
    }

    const adminSupa = getSupabaseAdmin()

    const { data: service } = await adminSupa
      .from('service_catalog')
      .select('id, name, price_cents')
      .eq('id', serviceId)
      .eq('contractor_id', contractorId)
      .eq('is_active', true)
      .maybeSingle()
    if (!service) return json({ error: 'Service not found for this business.' }, 400)

    const { data: settings } = await adminSupa
      .from('contractor_settings')
      .select('contact_email, contact_phone, company_name')
      .eq('id', contractorId)
      .single()

    const toEmail = settings?.contact_email
    const contractorPhone = settings?.contact_phone || null

    if (!toEmail) {
      return json({ error: 'Could not determine contractor email for this business.' }, 400)
    }

    const { first, last } = splitName(name)


    const { error: insertError } = await adminSupa.from('bookings').insert({
      contractor_id: contractorId,
      service_id: service.id,
      service_name: service.name,
      service_price_cents: service.price_cents || 0,
      customer_name: `${first || ''} ${last || ''}`.trim() || name,
      customer_email: email,
      customer_phone: phone || null,
      booking_date: date,
      booking_time: time,
      notes: notes?.trim().slice(0, 500) || null,
      status: 'pending'
    })

    if (insertError) {
      console.error('bookings insert failed:', insertError)
      return json({ error: 'Failed to save booking. Please try again.' }, 500)
    }

    // Send email via Resend
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const fmtPrice = (c: number) => `$${(c / 100).toFixed(2)}`
      
      const emailHtml = `
      <!DOCTYPE html>
      <html>
      <body style="font-family:sans-serif;padding:20px;">
        <h2>📅 New Booking Request</h2>
        <p>A new appointment has been requested.</p>
        <p><strong>Customer:</strong> ${name}<br/>
        <strong>Email:</strong> ${email}<br/>
        <strong>Phone:</strong> ${phone || 'N/A'}</p>
        <hr/>
        <p><strong>Service:</strong> ${service.name} (${fmtPrice(service.price_cents || 0)})<br/>
        <strong>Date:</strong> ${date}<br/>
        <strong>Time:</strong> ${time}<br/>
        <strong>Notes:</strong> ${notes || 'None'}</p>
      </body>
      </html>`
      
      const { error: emailError } = await resend.emails.send({
        from: platformFromEmail(),
        to: [toEmail],
        subject: `New booking request from ${name} on ${date}`,
        html: emailHtml,
      })
      if (emailError) console.error('send-booking email failed:', emailError)
    }

    if (contractorPhone) {
      try {
        await sendSms(
          contractorPhone,
          `New booking request from ${name} for ${service.name} on ${date} at ${time}. Check your email for details.`
        )
      } catch (err) {
        console.error('send-booking SMS failed:', err)
      }
    }

    return json({ success: true })
  } catch (error) {
    console.error('send-booking error:', error)
    return json({ error: 'Internal server error' }, 500)
  }
}
