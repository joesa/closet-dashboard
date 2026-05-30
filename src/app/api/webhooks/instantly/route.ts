import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { findPhonesByEmail } from '@/lib/outreach-leads'

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

      const relatedPhones = await findPhonesByEmail(admin, email)

      for (const phone of relatedPhones) {
        await admin.from('global_suppressions').upsert(
          {
            contact_value: phone,
            type: 'phone',
            source: 'instantly',
          },
          { onConflict: 'contact_value,type' }
        )
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
