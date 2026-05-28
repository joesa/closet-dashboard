import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const text = await req.text()
    const params = new URLSearchParams(text)

    const body = params.get('Body')?.trim().toLowerCase() || ''
    const from = params.get('From') || ''

    if (!from) {
      return NextResponse.json({ ok: false, error: 'Missing From' }, { status: 400 })
    }

    const stopWords = ['stop', 'unsubscribe', 'cancel', 'quit', 'end']
    if (stopWords.includes(body)) {
      const admin = getSupabaseAdmin()

      // 1. Add phone to global suppressions
      await admin.from('global_suppressions').upsert(
        {
          contact_value: from,
          type: 'phone',
          source: 'twilio',
        },
        { onConflict: 'contact_value,type' }
      )

      // 2. Find associated email in leads table
      const { data: leads } = await admin
        .from('leads')
        .select('email')
        .eq('phone', from)
        .not('email', 'is', null)

      if (leads && leads.length > 0) {
        for (const lead of leads) {
          if (lead.email) {
            // Add associated email to suppressions
            await admin.from('global_suppressions').upsert(
              {
                contact_value: lead.email,
                type: 'email',
                source: 'twilio',
              },
              { onConflict: 'contact_value,type' }
            )

            // Optional: Call Instantly API to mark lead as unsubscribed
            // Using Instantly V2 API
            const instantlyApiKey = process.env.INSTANTLY_API_KEY
            if (instantlyApiKey) {
              try {
                // Instantly requires campaign_id, but if we don't know it, we might need a different endpoint.
                // For now, we'll just log it. The scraper blocklist will prevent new outreach.
                console.log(`Syncing unsubscribe to Instantly for: ${lead.email}`)
              } catch (e) {
                console.error('Failed to sync to Instantly', e)
              }
            }
          }
        }
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
