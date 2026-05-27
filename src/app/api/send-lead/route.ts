import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { corsHeaders, handleOptions } from '@/lib/cors'
import { assertEntitled } from '@/lib/gate'
import { DEMO_CONTRACTOR_ID, isAllowedDemoOrigin } from '@/lib/demo'

export const runtime = 'edge'

// ── Types ──────────────────────────────────────────────────────────

interface SendLeadRequest {
  // The widget sends contractorId OR legacy contractorEmail/contractorName
  contractorId?: string
  contractorEmail?: string
  contractorName?: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  roomType?: string
  linearFeet?: number
  finishType?: string
  addOns?: Array<{ id: string, name: string, quantity: number }>
  selectedAddOns?: Array<{ id: string, quantity: number }>
  range?: { low: number; high: number }
  estimatedTotal?: number
  // Legacy shape
  calculatedLow?: number
  calculatedHigh?: number
  spaceDetails?: string
}

// ── Helpers ────────────────────────────────────────────────────────

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: corsHeaders })
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  })
}

function buildEmailHtml(
  lead: {
    customerName: string
    customerEmail: string
    customerPhone?: string
    calculatedLow: number
    calculatedHigh: number
    spaceDetails: string
  },
  companyName: string
): string {
  const midpoint = (lead.calculatedLow + lead.calculatedHigh) / 2;
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#6C47FF 0%,#4F46E5 100%);padding:32px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">
              🏠 New Closet Quote Lead
            </h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">
              A potential customer just requested a quote on your website.
            </p>
          </td>
        </tr>

        <!-- Customer Info -->
        <tr>
          <td style="padding:32px 40px 0;">
            <h2 style="margin:0 0 16px;font-size:16px;color:#1a1a2e;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">
              Customer Details
            </h2>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #eee;color:#6b7280;font-size:13px;width:140px;">Name</td>
                <td style="padding:10px 0;border-bottom:1px solid #eee;color:#1a1a2e;font-size:14px;font-weight:500;">${escapeHtml(lead.customerName)}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #eee;color:#6b7280;font-size:13px;">Email</td>
                <td style="padding:10px 0;border-bottom:1px solid #eee;color:#1a1a2e;font-size:14px;font-weight:500;">
                  <a href="mailto:${escapeHtml(lead.customerEmail)}" style="color:#6C47FF;text-decoration:none;">${escapeHtml(lead.customerEmail)}</a>
                </td>
              </tr>
              ${
                lead.customerPhone
                  ? `<tr>
                <td style="padding:10px 0;border-bottom:1px solid #eee;color:#6b7280;font-size:13px;">Phone</td>
                <td style="padding:10px 0;border-bottom:1px solid #eee;color:#1a1a2e;font-size:14px;font-weight:500;">${escapeHtml(lead.customerPhone)}</td>
              </tr>`
                  : ''
              }
            </table>
          </td>
        </tr>

        <!-- Quote Details -->
        <tr>
          <td style="padding:28px 40px 0;">
            <h2 style="margin:0 0 16px;font-size:16px;color:#1a1a2e;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">
              Space Details
            </h2>
            <div style="background:#f9fafb;border-radius:8px;padding:16px;color:#374151;font-size:14px;line-height:1.5;">
              ${escapeHtml(lead.spaceDetails).replace(/\n/g, '<br/>')}
            </div>
          </td>
        </tr>

        <!-- Price Range -->
        <tr>
          <td style="padding:28px 40px;">
            <div style="background:#f8f7ff;border:1px solid #e8e5ff;border-radius:10px;padding:24px;text-align:center;">
              <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">
                Estimated Range
              </p>
              <p style="margin:0;color:#6C47FF;font-size:28px;font-weight:700;">
                ${fmt(lead.calculatedLow)} – ${fmt(lead.calculatedHigh)}
              </p>
              <p style="margin:8px 0 0;color:#9ca3af;font-size:12px;">
                Midpoint: ${fmt(midpoint)}
              </p>
            </div>
          </td>
        </tr>

        <!-- CTA Button -->
        <tr>
          <td style="padding:0 40px 36px;" align="center">
            <a href="mailto:${escapeHtml(lead.customerEmail)}?subject=${encodeURIComponent(`Your Closet Quote from ${companyName}`)}&body=${encodeURIComponent(`Hi ${lead.customerName},\n\nThank you for your interest! Based on your details, your estimated range is ${fmt(lead.calculatedLow)} – ${fmt(lead.calculatedHigh)}.\n\nI'd love to schedule a time to discuss your project in more detail.\n\nBest regards,\n${companyName}`)}"
               style="display:inline-block;background:linear-gradient(135deg,#6C47FF 0%,#4F46E5 100%);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;box-shadow:0 4px 12px rgba(108,71,255,0.3);">
              ✉️&nbsp; Reply to ${escapeHtml(lead.customerName)}
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#fafafa;padding:20px 40px;border-top:1px solid #eee;">
            <p style="margin:0;color:#9ca3af;font-size:11px;text-align:center;">
              Sent by <strong>ClosetQuote</strong> · This is an automated lead notification.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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

function splitName(full: string): { first: string | null; last: string | null } {
  const parts = full.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return { first: null, last: null }
  const [first, ...rest] = parts
  return { first, last: rest.length > 0 ? rest.join(' ') : null }
}

// ── Twilio SMS (Edge-compatible via REST API) ──────────────────────

async function sendSms(to: string, body: string): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    console.warn('Twilio env vars not configured — skipping SMS.')
    return
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
  const credentials = btoa(`${accountSid}:${authToken}`)

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      To: to,
      From: fromNumber,
      Body: body,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Twilio SMS error:', res.status, err)
  }
}

// ── CORS preflight ─────────────────────────────────────────────────

export function OPTIONS() {
  return handleOptions()
}

// ── POST handler ───────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SendLeadRequest

    // ── Demo-account anti-theft (server side) ──
    // Refuse to deliver leads for the public demo contractor when the
    // submission is coming from an origin we don't recognise. Mirrors
    // the same check in /api/calculate.
    if (body.contractorId && body.contractorId === DEMO_CONTRACTOR_ID) {
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

    // ── Validate required fields ──
    if (!body.customerName || !body.customerEmail) {
      return json(
        { error: 'customerName and customerEmail are required.' },
        400
      )
    }

    // ── Normalize the price range ──
    // Widget sends range.low / range.high; legacy sends calculatedLow / calculatedHigh
    const calculatedLow = body.calculatedLow ?? body.range?.low ?? 0
    const calculatedHigh = body.calculatedHigh ?? body.range?.high ?? 0

    if (!calculatedLow || !calculatedHigh) {
      return json({ error: 'Price range is required (range or calculatedLow/calculatedHigh).' }, 400)
    }

    // ── Resolve contractor email and add-ons ──
    let toEmail = body.contractorEmail || ''
    let companyName = body.contractorName || 'Your Company'
    // The contractor's personal cell number — populated from
    // contractor_settings.contact_phone if we have a contractorId. When
    // present we text this number a fully-qualified lead alert (replacing the
    // old behaviour of texting the homeowner a generic confirmation).
    let contractorPhone: string | null = null
    let addOnLines: string[] = []

    // If we have a contractorId, look up their settings and addons from the database
    if (body.contractorId) {
      // Entitlement gate — refuse to deliver leads for expired contractors.
      // This is the actual conversion lever: an expired account can no longer
      // receive SMS/email leads from their embedded widget.
      const blocked = await assertEntitled(body.contractorId)
      if (blocked) return blocked

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { data: settings, error: dbError } = await supabase
        .from('contractor_settings')
        .select('contact_email, contact_phone, company_name')
        .eq('id', body.contractorId)
        .single()

      if (!dbError && settings) {
        if (settings.contact_email) toEmail = settings.contact_email
        if (settings.company_name) companyName = settings.company_name
        if (settings.contact_phone) contractorPhone = settings.contact_phone
      }

      // Fetch Addons to resolve specific names
      const requestedAddOns = body.selectedAddOns || body.addOns || [];
      if (requestedAddOns.length > 0) {
        const { data: addonsData } = await supabase
          .from('contractor_addons')
          .select('id, name')
          .eq('contractor_id', body.contractorId)
        
        if (addonsData) {
          for (const item of requestedAddOns) {
            const addonInfo = addonsData.find(a => a.id === item.id)
            if (addonInfo) {
              addOnLines.push(`${addonInfo.name}: ${item.quantity}`)
            } else {
              addOnLines.push(`${(item as any).name || 'Add-on'} (${item.id}): ${item.quantity}`)
            }
          }
        }
      }
    } else {
      addOnLines = (body.addOns || []).map(a => `${a.name || a.id}: ${a.quantity}`)
    }

    // ── Build space details string from widget fields ──
    const spaceDetails =
      body.spaceDetails ||
      [
        body.linearFeet ? `Linear Feet: ${body.linearFeet}` : null,
        body.finishType ? `Finish: ${body.finishType}` : null,
        ...addOnLines,
        body.estimatedTotal ? `Estimated Total: $${body.estimatedTotal.toFixed(2)}` : null,
      ]
        .filter(Boolean)
        .join('\n') || 'No details provided'

    if (!toEmail) {
      return json({ error: 'Could not determine contractor email. Provide contractorId or contractorEmail.' }, 400)
    }

    // ── Send email via Resend ──
    const resend = new Resend(process.env.RESEND_API_KEY)

    const { data, error } = await resend.emails.send({
      from: 'ClosetQuote <admin@closetquotes.com>',
      to: [toEmail],
      replyTo: body.customerEmail,
      subject: `🏠 New Quote Lead: ${body.customerName} — ${fmt(calculatedLow)}–${fmt(calculatedHigh)}`,
      html: buildEmailHtml(
        {
          customerName: body.customerName,
          customerEmail: body.customerEmail,
          customerPhone: body.customerPhone,
          calculatedLow,
          calculatedHigh,
          spaceDetails,
        },
        companyName
      ),
    })

    if (error) {
      console.error('Resend error:', error)
      return json({ error: 'Failed to send email.', details: error }, 500)
    }

    // ── Best-effort persistence of the lead row ──
    // Stored in public.leads so admins can review the inbox.
    // Uses service role to bypass RLS. Failures are swallowed.
    if (body.contractorId) {
      try {
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (serviceKey) {
          const adminSupa = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceKey,
            { auth: { persistSession: false } }
          )
          const { first, last } = splitName(body.customerName)
          const origin =
            request.headers.get('origin') ||
            request.headers.get('referer') ||
            null
          const ua = request.headers.get('user-agent') || null
          const ipHash = await hashIp(
            request.headers.get('x-forwarded-for') ||
              request.headers.get('cf-connecting-ip') ||
              ''
          )
          await adminSupa.from('leads').insert({
            contractor_id: body.contractorId,
            first_name: first,
            last_name: last,
            email: body.customerEmail,
            phone: body.customerPhone ?? null,
            message: spaceDetails,
            room_type: body.roomType ?? null,
            finish_type: body.finishType ?? null,
            linear_feet: body.linearFeet ?? null,
            estimated_total: body.estimatedTotal ?? null,
            range_low: calculatedLow,
            range_high: calculatedHigh,
            add_ons: body.selectedAddOns ?? body.addOns ?? null,
            source_origin: origin,
            user_agent: ua,
            ip_hash: ipHash,
          })
        }
      } catch (leadInsertErr) {
        console.error('leads insert failed:', leadInsertErr)
      }
    }

    // ── Send SMS LEAD ALERT to the contractor via Twilio (non-blocking) ──
    // This replaces the previous customer-confirmation text. Contractors get a
    // fully-qualified lead breakdown on their phone the second a homeowner
    // submits the widget — the dopamine hit our sales copy promises.
    //
    // DEMO BYPASS: if the request is from our public demo contractor id, skip
    // Twilio entirely so prospects playing with the landing-page widget can't
    // drain our SMS balance. We still build the preview string so the widget
    // can render an "this is what your phone would have buzzed with" card on
    // the success screen — the whole point of the demo is to show the
    // contractor what they'd receive.
    //
    // LOOM RECORDING OVERRIDE: when the embedded widget is served from the
    // basic-closet-demo site (used for Loom walkthroughs), we want it to
    // behave like a real production submission — actually fire the SMS and
    // render the regular "we've emailed your quote" copy on the widget,
    // not the demo banner. The contractor on record for that site is still
    // the demo contractor, so we look at the request Origin to decide.
    const submissionOrigin =
      request.headers.get('origin') ||
      request.headers.get('referer') ||
      ''
    const LOOM_RECORDING_ORIGINS = [
      'https://basic-closet-demo.vercel.app',
    ]
    const isLoomRecordingOrigin = (() => {
      if (!submissionOrigin) return false
      try {
        const u = new URL(submissionOrigin)
        const normalized = `${u.protocol}//${u.host}`.toLowerCase()
        return LOOM_RECORDING_ORIGINS.includes(normalized)
      } catch {
        return false
      }
    })()
    const isDemoSubmission =
      body.contractorId === DEMO_CONTRACTOR_ID && !isLoomRecordingOrigin

    // Build the SMS body up front so we can either send it or echo it back
    // as a preview. Falls back to a stub when we have no contractor phone
    // and it's not a demo (preserves prior behaviour of just skipping).
    const rangeStr = `${fmt(calculatedLow)}–${fmt(calculatedHigh)}`
    const smsLines: string[] = []
    smsLines.push(`🚨 NEW LEAD: ${body.customerName}`)
    if (body.customerPhone) smsLines.push(`📞 ${body.customerPhone}`)
    smsLines.push(`✉️ ${body.customerEmail}`)
    smsLines.push('')
    if (body.linearFeet || body.roomType) {
      const ft = body.linearFeet ? `${body.linearFeet}ft ` : ''
      const room = body.roomType || 'Closet'
      smsLines.push(`🛠️ ${ft}${room}`)
    }
    if (body.finishType) smsLines.push(`🎨 Finish: ${body.finishType}`)
    if (addOnLines.length > 0) {
      smsLines.push(`➕ Add-ons: ${addOnLines.join(', ')}`)
    }
    smsLines.push(`💰 Quoted: ${rangeStr}`)
    const smsBody = smsLines.join('\n')

    let smsSent = false
    if (isDemoSubmission) {
      console.log('Demo mode: SMS bypassed for contractorId', body.contractorId)
    } else if (contractorPhone) {
      try {
        await sendSms(contractorPhone, smsBody)
        smsSent = true
      } catch (smsErr) {
        // Log but don't fail the request — email already sent.
        console.error('SMS delivery failed:', smsErr)
      }
    }

    return json({
      success: true,
      emailId: data?.id,
      smsSent,
      isDemo: isDemoSubmission,
      // Only echo the SMS body back to the client on demo submissions so the
      // widget can render the "what your phone would have buzzed with"
      // preview. Real submissions don't need (and shouldn't leak) it.
      smsPreview: isDemoSubmission ? smsBody : undefined,
    })
  } catch (err) {
    console.error('Send lead error:', err)
    return json({ error: 'Invalid request body or Server Error.' }, 400)
  }
}
