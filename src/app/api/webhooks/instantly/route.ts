import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const email = body.lead_email?.trim().toLowerCase()
    const eventType = body.event_type

    if (!email) {
      return NextResponse.json({ ok: false, error: 'Missing lead_email' }, { status: 400 })
    }

    if (eventType === 'Unsubscribed') {
      const admin = getSupabaseAdmin()

      // 1. Add email to global suppressions
      await admin.from('global_suppressions').upsert(
        {
          contact_value: email,
          type: 'email',
          source: 'instantly',
        },
        { onConflict: 'contact_value,type' }
      )

      // 2. Find associated phone in leads table
      const { data: leads } = await admin
        .from('leads')
        .select('phone')
        .eq('email', email)
        .not('phone', 'is', null)

      if (leads && leads.length > 0) {
        for (const lead of leads) {
          if (lead.phone) {
            // Add associated phone to suppressions
            await admin.from('global_suppressions').upsert(
              {
                contact_value: lead.phone,
                type: 'phone',
                source: 'instantly',
              },
              { onConflict: 'contact_value,type' }
            )
            // Twilio automatically checks global_suppressions before we send future SMS,
            // or the scraper simply filters out this lead so they are never exported.
          }
        }
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
