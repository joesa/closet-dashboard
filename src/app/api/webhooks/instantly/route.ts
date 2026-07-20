import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { findPhonesByEmail } from '@/lib/outreach-leads'
import { assertWebhookToken } from '@/lib/webhook-auth'

export const runtime = 'nodejs'

/**
 * Instantly "Unsubscribed" webhook.
 * Auth: INSTANTLY_WEBHOOK_SECRET, falling back to INSTANTLY_RECEIVER_AUTH_TOKEN.
 * Configure Instantly → Settings → Webhooks → Unsubscribed → this URL with
 * Authorization: Bearer <secret> (or x-webhook-token).
 */
export async function POST(req: Request) {
  try {
    const expected =
      process.env.INSTANTLY_WEBHOOK_SECRET?.trim() ||
      process.env.INSTANTLY_RECEIVER_AUTH_TOKEN?.trim()
    const authError = assertWebhookToken(req, expected, {
      missingEnvMessage:
        'INSTANTLY_WEBHOOK_SECRET (or INSTANTLY_RECEIVER_AUTH_TOKEN) is not configured',
    })
    if (authError) return authError

    const body = await req.json()
    const email = body.lead_email?.trim().toLowerCase()
    const eventType = body.event_type

    if (!email) {
      return NextResponse.json({ ok: false, error: 'Missing lead_email' }, { status: 400 })
    }

    if (eventType === 'Unsubscribed') {
      const admin = getSupabaseAdmin()

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
