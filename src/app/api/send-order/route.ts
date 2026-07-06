import { Resend } from 'resend'
import { corsHeaders, handleOptions } from '@/lib/cors'
import { assertEntitled } from '@/lib/gate'
import { checkRateLimit, hashIpForRateLimit } from '@/lib/rate-limit'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { sendSms } from '@/lib/twilio-sms'

export const runtime = 'edge'

// ── Types ──────────────────────────────────────────────────────────

interface OrderItemInput {
  id: string
  name: string
  price: number
  quantity: number
}

interface SendOrderRequest {
  contractorId: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  items: OrderItemInput[]
  fulfillmentType?: 'pickup' | 'delivery'
  notes?: string
}

// ── Helpers ────────────────────────────────────────────────────────

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: corsHeaders })
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function escapeHtml(str: string): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function splitName(full: string): { first: string | null; last: string | null } {
  const parts = full.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return { first: null, last: null }
  const [first, ...rest] = parts
  return { first, last: rest.length > 0 ? rest.join(' ') : null }
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

function buildOrderEmailHtml(order: {
  customerName: string
  customerEmail: string
  customerPhone?: string
  items: OrderItemInput[]
  total: number
  fulfillmentType: string
  notes?: string
}, companyName: string): string {
  const itemRows = order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;color:#333;">${escapeHtml(item.name)} &times; ${item.quantity}</td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;color:#333;text-align:right;">${fmt(item.price * item.quantity)}</td>
        </tr>`
    )
    .join('')

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr>
          <td style="background:linear-gradient(135deg,#6C47FF 0%,#4F46E5 100%);padding:32px 40px;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">🧾 New Order — ${companyName}</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">
              A customer just placed an order for ${order.fulfillmentType}.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${itemRows}
              <tr>
                <td style="padding:12px 0 0;font-weight:700;color:#111;">Total</td>
                <td style="padding:12px 0 0;font-weight:700;color:#111;text-align:right;">${fmt(order.total)}</td>
              </tr>
            </table>
            <p style="margin:24px 0 0;color:#555;font-size:14px;line-height:1.6;">
              <strong>Customer:</strong> ${escapeHtml(order.customerName)}<br/>
              <strong>Email:</strong> ${escapeHtml(order.customerEmail)}<br/>
              ${order.customerPhone ? `<strong>Phone:</strong> ${escapeHtml(order.customerPhone)}<br/>` : ''}
              <strong>Fulfillment:</strong> ${escapeHtml(order.fulfillmentType)}<br/>
              ${order.notes ? `<strong>Notes:</strong> ${escapeHtml(order.notes)}<br/>` : ''}
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── CORS preflight ─────────────────────────────────────────────────

export function OPTIONS() {
  return handleOptions()
}

// ── POST handler ───────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SendOrderRequest

    if (!body.contractorId) {
      return json({ error: 'contractorId is required.' }, 400)
    }
    if (!body.customerName || !body.customerEmail) {
      return json({ error: 'customerName and customerEmail are required.' }, 400)
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return json({ error: 'Your cart is empty.' }, 400)
    }

    const items = body.items
      .filter((i) => i && typeof i.name === 'string' && Number.isFinite(i.quantity) && i.quantity > 0)
      .slice(0, 50)
      .map((i) => ({
        id: String(i.id || ''),
        name: i.name.trim().slice(0, 200),
        price: Number.isFinite(i.price) && i.price >= 0 ? i.price : 0,
        quantity: Math.max(1, Math.floor(i.quantity)),
      }))
    if (items.length === 0) {
      return json({ error: 'Your cart is empty.' }, 400)
    }
    const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
    const fulfillmentType = body.fulfillmentType === 'delivery' ? 'delivery' : 'pickup'

    // Entitlement gate — same expired-account cutoff as /api/send-lead.
    const blocked = await assertEntitled(body.contractorId)
    if (blocked) return blocked

    const ipForLimit =
      request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || ''
    const ipHashLimit = await hashIpForRateLimit(ipForLimit)
    const rateLimit = await checkRateLimit(`send-order:${body.contractorId}:${ipHashLimit}`, 10, 60)
    if (!rateLimit.allowed) {
      return json({ error: 'rate_limited', retryAfterSeconds: rateLimit.retryAfterSeconds }, 429)
    }

    const adminSupa = getSupabaseAdmin()

    // contact_email/contact_phone are not granted to anon (see
    // 20260601150000_tenant_rls_and_config_extras.sql) — need service role.
    const { data: settings } = await adminSupa
      .from('contractor_settings')
      .select('contact_email, contact_phone, company_name')
      .eq('id', body.contractorId)
      .single()

    const toEmail = settings?.contact_email
    const companyName = settings?.company_name || 'Your Business'
    const contractorPhone = settings?.contact_phone || null

    if (!toEmail) {
      return json({ error: 'Could not determine contractor email for this business.' }, 400)
    }

    // ── Persist the order (denormalized item snapshot, same rationale as leads) ──
    const { first, last } = splitName(body.customerName)
    const origin = request.headers.get('origin') || request.headers.get('referer') || null
    const ua = request.headers.get('user-agent') || null
    const ipHash = await hashIp(
      request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || ''
    )

    const { error: orderInsertError } = await adminSupa.from('orders').insert({
      contractor_id: body.contractorId,
      customer_name: `${first || ''} ${last || ''}`.trim() || body.customerName,
      customer_email: body.customerEmail,
      customer_phone: body.customerPhone ?? null,
      items,
      order_total: total,
      fulfillment_type: fulfillmentType,
      notes: body.notes?.trim().slice(0, 500) || null,
      source_origin: origin,
      user_agent: ua,
      ip_hash: ipHash,
    })

    if (orderInsertError) {
      console.error('orders insert failed:', orderInsertError)
      return json({ error: 'Failed to save order. Please try again.' }, 500)
    }

    // ── Send email via Resend ──
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error: emailError } = await resend.emails.send({
      from: process.env.INTAKE_FROM_EMAIL || 'DitchTheForm <admin@closetquotes.com>',
      to: [toEmail],
      subject: `New order from ${body.customerName} — ${fmt(total)}`,
      html: buildOrderEmailHtml(
        {
          customerName: body.customerName,
          customerEmail: body.customerEmail,
          customerPhone: body.customerPhone,
          items,
          total,
          fulfillmentType,
          notes: body.notes,
        },
        companyName
      ),
    })
    if (emailError) console.error('send-order email failed:', emailError)

    // ── Optional SMS notify (best-effort, mirrors send-lead) ──
    if (contractorPhone) {
      try {
        await sendSms(
          contractorPhone,
          `New order (${fmt(total)}) from ${body.customerName} — ${items.length} item${items.length === 1 ? '' : 's'}, ${fulfillmentType}. Check your email for details.`
        )
      } catch (err) {
        console.error('send-order SMS failed:', err)
      }
    }

    return json({ success: true, orderTotal: total })
  } catch (error) {
    console.error('send-order error:', error)
    return json({ error: 'Internal server error' }, 500)
  }
}
