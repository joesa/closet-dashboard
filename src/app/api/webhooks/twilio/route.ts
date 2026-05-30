import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { sendSms } from '@/lib/twilio-sms'

export const runtime = 'nodejs'

// ── Positive intent detection ──────────────────────────────────────

const STOP_WORDS = ['stop', 'unsubscribe', 'cancel', 'quit', 'end']

const POSITIVE_PATTERNS = [
  // Direct yes
  /^y(es|ep|eah|a|up)?[.!]?$/,
  /^sure[.!]?$/,
  /^ok(ay)?[.!]?$/,
  /^sounds? good/,
  /^i'?m (interested|down|in)/,
  /^interested/,
  /^let'?s (do it|go|see)/,
  /^(show|send|hit) (me|it)/,
  /^(absolutely|definitely|for sure)/,
  /^(please|pls)/,
  /^(that works|works for me)/,
  /^(love|like) (to|that)/,
  /^tell me more/,
  /^(sign me up|count me in)/,
  // Questions that indicate interest
  /^how (much|does|do|long|would)/,
  /^what (does|do|is|are|would)/,
  /^can (you|i|we)/,
  /^(demo|website|site|link|url|video)/,
]

function isPositiveReply(message: string): boolean {
  const normalized = message.trim().toLowerCase()
  if (!normalized || normalized.length > 300) return false
  if (STOP_WORDS.includes(normalized)) return false
  return POSITIVE_PATTERNS.some((pattern) => pattern.test(normalized))
}

// ── Demo showcase reply ────────────────────────────────────────────

const DEMO_REPLY = `Great to hear from you! 🎉 Here are 3 live demo sites I built for closet contractors — each one includes the built-in quote calculator that texts leads to your phone:

🏠 Lumina Custom Closets (luxury minimal)
→ https://lumina.closetquotes.com

🔨 Ironclad Storage Co. (bold industrial)
→ https://ironclad.closetquotes.com

🏡 Hearth & Home Spaces (classic warm)
→ https://hearth.closetquotes.com

Try the quote calculator on any of them — pick your room, materials, and watch it generate an instant estimate. That's exactly what your future customers would see.

Want me to mock up a free version for your business? Just reply with your business name! - Joseph`

// ── Main handler ───────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const text = await req.text()
    const params = new URLSearchParams(text)

    const body = params.get('Body')?.trim() || ''
    const bodyLower = body.toLowerCase()
    const from = params.get('From') || ''

    if (!from) {
      return NextResponse.json({ ok: false, error: 'Missing From' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()

    // ── Log every inbound reply (fire-and-forget) ──
    try {
      await admin.from('sms_outreach_events').insert({
        event_key: `inbound:${from}:${Date.now()}`,
        run_id: 'inbound',
        phone_number: from,
        business_name: null,
        source_location: null,
        message_step: 0,
        message_body: body,
        status: 'inbound_reply',
      })
    } catch { /* non-critical */ }

    // ── Handle STOP / unsubscribe ──
    if (STOP_WORDS.includes(bodyLower)) {
      await admin.from('global_suppressions').upsert(
        {
          contact_value: from,
          type: 'phone',
          source: 'twilio',
        },
        { onConflict: 'contact_value,type' }
      )

      // Find associated email in leads table
      const { data: leads } = await admin
        .from('leads')
        .select('email')
        .eq('phone', from)
        .not('email', 'is', null)

      if (leads && leads.length > 0) {
        for (const lead of leads) {
          if (lead.email) {
            await admin.from('global_suppressions').upsert(
              {
                contact_value: lead.email,
                type: 'email',
                source: 'twilio',
              },
              { onConflict: 'contact_value,type' }
            )

            const instantlyApiKey = process.env.INSTANTLY_API_KEY
            if (instantlyApiKey) {
              try {
                console.log(`Syncing unsubscribe to Instantly for: ${lead.email}`)
              } catch (e) {
                console.error('Failed to sync to Instantly', e)
              }
            }
          }
        }
      }

      // Return empty TwiML (Twilio auto-sends "You have been unsubscribed")
      return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        headers: { 'Content-Type': 'text/xml' },
      })
    }

    // ── Handle positive replies → send demo sites ──
    if (isPositiveReply(bodyLower)) {
      console.log(`Positive reply detected from ${from}: "${body}"`)

      // Check we haven't already sent the demo reply to this number recently
      const { data: recentDemo } = await admin
        .from('sms_outreach_events')
        .select('id')
        .eq('phone_number', from)
        .eq('status', 'demo_sent')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .maybeSingle()

      if (!recentDemo) {
        const result = await sendSms(from, DEMO_REPLY)

        await admin.from('sms_outreach_events').insert({
          event_key: `demo:${from}:${Date.now()}`,
          run_id: 'auto_reply',
          phone_number: from,
          business_name: null,
          source_location: null,
          message_step: 99,
          message_body: DEMO_REPLY,
          twilio_message_sid: result.messageSid,
          status: result.success ? 'demo_sent' : 'demo_failed',
          error: result.error,
        })
      }
    }

    // Twilio expects an empty TwiML response
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
