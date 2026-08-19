import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { verifyResendSignature } from '@/lib/email/verifyResendSignature'

/**
 * Delivery receipts for outbound mail.
 *
 * `email_sends` has carried `delivered_at` and `failed_at` since it was
 * created, and nothing ever wrote them — a send was recorded as 'sent' the
 * moment Resend accepted it, which says nothing about whether it landed. A
 * bounced lead notification looked exactly like a delivered one, so a customer
 * could quietly stop receiving leads and the platform's own record would show
 * everything fine.
 *
 * Rows are matched on `provider_message_id`, which send.ts already stores.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Resend event type → the row state it implies. */
const STATUS_BY_EVENT: Record<string, { status: string; stamp?: 'delivered_at' | 'failed_at' }> = {
  'email.sent': { status: 'sent' },
  'email.delivered': { status: 'delivered', stamp: 'delivered_at' },
  'email.delivery_delayed': { status: 'delayed' },
  'email.bounced': { status: 'bounced', stamp: 'failed_at' },
  'email.complained': { status: 'complained', stamp: 'failed_at' },
}

export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    // Unconfigured must not mean "accept anything".
    console.warn('[resend-webhook] RESEND_WEBHOOK_SECRET unset; rejecting')
    return NextResponse.json({ error: 'not configured' }, { status: 503 })
  }

  const body = await req.text()
  const verified = verifyResendSignature({
    secret,
    body,
    svixId: req.headers.get('svix-id'),
    svixTimestamp: req.headers.get('svix-timestamp'),
    svixSignature: req.headers.get('svix-signature'),
    nowSeconds: Math.floor(Date.now() / 1000),
  })
  if (!verified.ok) {
    return NextResponse.json({ error: verified.reason }, { status: 401 })
  }

  let event: { type?: string; data?: { email_id?: string } }
  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const mapped = event.type ? STATUS_BY_EVENT[event.type] : undefined
  const messageId = event.data?.email_id
  // Unknown event types are acknowledged, not retried — Resend adds new ones.
  if (!mapped || !messageId) return NextResponse.json({ ok: true, ignored: true })

  const patch: Record<string, unknown> = { status: mapped.status }
  if (mapped.stamp) patch[mapped.stamp] = new Date().toISOString()

  const { error } = await getSupabaseAdmin()
    .from('email_sends')
    .update(patch)
    .eq('provider_message_id', messageId)

  if (error) {
    // 500 so Svix retries; losing a receipt should not be silent.
    console.error('[resend-webhook] update failed:', error.message)
    return NextResponse.json({ error: 'update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
