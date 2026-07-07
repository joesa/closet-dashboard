import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { corsHeaders, handleOptions } from '@/lib/cors'
import { assertEntitled } from '@/lib/gate'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { checkRateLimit, hashIpForRateLimit } from '@/lib/rate-limit'

import { sendSms } from '@/lib/twilio-sms'
import { splitName } from '@/lib/nameUtils'

export const runtime = 'edge'

const json = (data: any, status = 200) =>
  NextResponse.json(data, { status, headers: corsHeaders })

export function OPTIONS() {
  return handleOptions()
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      contractorId, eventId, eventName,
      name, email, phone, quantity, totalCents
    } = body

    if (!contractorId) return json({ error: 'contractorId is required.' }, 400)
    if (!name || !email) return json({ error: 'name and email are required.' }, 400)
    if (!eventId || !eventName) return json({ error: 'eventId and eventName are required.' }, 400)
    if (!quantity || quantity < 1) return json({ error: 'valid quantity is required.' }, 400)

    const blocked = await assertEntitled(contractorId)
    if (blocked) return blocked

    const ipForLimit = request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || ''
    const ipHashLimit = await hashIpForRateLimit(ipForLimit)
    const rateLimit = await checkRateLimit(`send-ticket:${contractorId}:${ipHashLimit}`, 10, 60)
    if (!rateLimit.allowed) {
      return json({ error: 'rate_limited', retryAfterSeconds: rateLimit.retryAfterSeconds }, 429)
    }

    const adminSupa = getSupabaseAdmin()

    const { data: settings } = await adminSupa
      .from('contractor_settings')
      .select('contact_email, contact_phone, company_name')
      .eq('id', contractorId)
      .single()

    const toEmail = settings?.contact_email
    const companyName = settings?.company_name || 'Your Business'
    const contractorPhone = settings?.contact_phone || null

    if (!toEmail) {
      return json({ error: 'Could not determine contractor email for this business.' }, 400)
    }

    const { first, last } = splitName(name)

    const { error: insertError } = await adminSupa.from('ticket_orders').insert({
      contractor_id: contractorId,
      event_id: eventId,
      event_name: eventName,
      customer_name: `${first || ''} ${last || ''}`.trim() || name,
      customer_email: email,
      customer_phone: phone || null,
      quantity,
      total_cents: totalCents || 0,
      status: 'pending'
    })

    if (insertError) {
      console.error('ticket_orders insert failed:', insertError)
      return json({ error: 'Failed to process ticket request. Please try again.' }, 500)
    }

    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const fmtPrice = (c: number) => `$${(c / 100).toFixed(2)}`
      
      const emailHtml = `
      <!DOCTYPE html>
      <html>
      <body style="font-family:sans-serif;padding:20px;">
        <h2>🎟️ New Ticket Request</h2>
        <p>A customer has requested tickets for an event.</p>
        <p><strong>Customer:</strong> ${name}<br/>
        <strong>Email:</strong> ${email}<br/>
        <strong>Phone:</strong> ${phone || 'N/A'}</p>
        <hr/>
        <p><strong>Event:</strong> ${eventName}<br/>
        <strong>Tickets:</strong> ${quantity}<br/>
        <strong>Total:</strong> ${fmtPrice(totalCents || 0)}</p>
      </body>
      </html>`
      
      const { error: emailError } = await resend.emails.send({
        from: process.env.INTAKE_FROM_EMAIL || 'DitchTheForm <admin@closetquotes.com>',
        to: [toEmail],
        subject: `New ticket request from ${name} for ${eventName}`,
        html: emailHtml,
      })
      if (emailError) console.error('send-ticket email failed:', emailError)
    }

    if (contractorPhone) {
      try {
        await sendSms(
          contractorPhone,
          `New ticket request from ${name} for ${quantity}x ${eventName}. Check your email for details.`
        )
      } catch (err) {
        console.error('send-ticket SMS failed:', err)
      }
    }

    return json({ success: true })
  } catch (error) {
    console.error('send-ticket error:', error)
    return json({ error: 'Internal server error' }, 500)
  }
}
