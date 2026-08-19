import { NextResponse } from 'next/server'
import { corsHeaders, handleOptions } from '@/lib/cors'
import { assertEntitled } from '@/lib/gate'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { checkRateLimit, hashIpForRateLimit } from '@/lib/rate-limit'
import { checkWidgetCaptcha } from '@/lib/turnstileWidgetGuard'
import { sendEmail } from '@/lib/email/send'
import { renderEmail } from '@/lib/email/layout'

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
    // Verified when the widget sends one; not yet demanded of the
    // bundles already embedded on customer sites. See turnstileWidgetGuard.
    const captcha = await checkWidgetCaptcha(
      (body as { turnstileToken?: unknown }).turnstileToken,
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined
    )
    if (!captcha.ok) {
      return json({ error: captcha.error }, captcha.status)
    }

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
      const fmtPrice = (c: number) => `$${(c / 100).toFixed(2)}`

      // renderEmail escapes every value. The previous version interpolated the
      // customer's name and notes straight into an HTML string, so anything a
      // visitor typed was markup in the contractor's inbox.
      const emailHtml = renderEmail({
        heading: 'New booking request',
        blocks: [
          { type: 'text', text: 'A new appointment has been requested.' },
          {
            type: 'facts',
            rows: [
              ['Customer', name],
              ['Email', email],
              ['Phone', phone || 'Not given'],
              ['Service', `${service.name} (${fmtPrice(service.price_cents || 0)})`],
              ['Date', date],
              ['Time', time],
              ['Notes', notes || 'None'],
            ],
          },
        ],
      })

      const emailResult = await sendEmail({
        kind: 'booking.request',
        to: toEmail,
        contractorId,
        replyTo: email,
        subject: `New booking request from ${name} on ${date}`,
        html: emailHtml,
      })
      const emailError = emailResult.sent ? null : emailResult.error ?? emailResult.reason
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
