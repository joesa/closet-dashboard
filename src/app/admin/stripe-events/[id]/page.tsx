import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { refundAction } from './actions'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type StripeEventRow = {
  id: string
  type: string
  payload: Record<string, unknown>
  received_at: string
  processed_at: string | null
  process_error: string | null
}

type Refundable = { kind: 'charge' | 'payment_intent'; id: string; amount?: number | null; currency?: string | null }

function stripeMode(): 'live' | 'test' {
  return (process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_live_') ? 'live' : 'test'
}

function stripeUrl(kind: string, id: string): string {
  const prefix = stripeMode() === 'live' ? 'https://dashboard.stripe.com' : 'https://dashboard.stripe.com/test'
  return `${prefix}/${kind}/${id}`
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString()
}

/** Walk the event payload to find a charge or payment_intent we could refund. */
function findRefundables(payload: Record<string, unknown>): Refundable[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (payload as any)?.data?.object as Record<string, unknown> | undefined
  if (!data) return []

  const out: Refundable[] = []
  const objectType = String(data.object ?? '')

  if (objectType === 'charge' && typeof data.id === 'string') {
    out.push({
      kind: 'charge',
      id: data.id,
      amount: typeof data.amount === 'number' ? data.amount : null,
      currency: typeof data.currency === 'string' ? data.currency : null,
    })
  }
  if (objectType === 'payment_intent' && typeof data.id === 'string') {
    out.push({
      kind: 'payment_intent',
      id: data.id,
      amount: typeof data.amount === 'number' ? data.amount : null,
      currency: typeof data.currency === 'string' ? data.currency : null,
    })
  }
  // Invoice events expose a `charge` and/or `payment_intent` field.
  if (objectType === 'invoice') {
    if (typeof data.charge === 'string') {
      out.push({
        kind: 'charge',
        id: data.charge,
        amount: typeof data.amount_paid === 'number' ? data.amount_paid : null,
        currency: typeof data.currency === 'string' ? data.currency : null,
      })
    }
    if (typeof data.payment_intent === 'string') {
      out.push({
        kind: 'payment_intent',
        id: data.payment_intent,
        amount: typeof data.amount_paid === 'number' ? data.amount_paid : null,
        currency: typeof data.currency === 'string' ? data.currency : null,
      })
    }
  }
  // Checkout session
  if (objectType === 'checkout.session') {
    if (typeof data.payment_intent === 'string') {
      out.push({
        kind: 'payment_intent',
        id: data.payment_intent,
        amount: typeof data.amount_total === 'number' ? data.amount_total : null,
        currency: typeof data.currency === 'string' ? data.currency : null,
      })
    }
  }
  // De-dupe by kind+id
  const seen = new Set<string>()
  return out.filter((r) => {
    const k = `${r.kind}:${r.id}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

function dollarStr(cents: number | null | undefined, currency?: string | null): string {
  if (cents == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: (currency || 'usd').toUpperCase(),
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

export default async function StripeEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const admin = getSupabaseAdmin()

  const { data } = await admin
    .from('stripe_webhook_events')
    .select('id, type, payload, received_at, processed_at, process_error')
    .eq('id', id)
    .maybeSingle()

  if (!data) notFound()
  const event = data as StripeEventRow

  // Pull related audit rows (refund attempts on this event)
  const { data: audit } = await admin
    .from('admin_audit_log')
    .select('id, action, actor_email, metadata, created_at')
    .eq('target_type', 'stripe_event')
    .eq('target_id', id)
    .order('created_at', { ascending: false })
    .limit(20)

  const refundables = findRefundables(event.payload)
  const eventLink = stripeUrl('events', event.id)

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/stripe-events" className="text-xs text-blue-600 hover:underline">
          ← Stripe events
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="font-mono text-lg font-semibold text-gray-900">{event.id}</h1>
          <a
            href={eventLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline"
          >
            open in Stripe ↗
          </a>
          <span className="font-mono text-xs text-gray-400">{stripeMode()}</span>
        </div>
        <div className="mt-1 text-sm text-gray-600">
          <span className="font-mono">{event.type}</span> · received {fmt(event.received_at)}
        </div>
      </div>

      {/* Status */}
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Processing status</h2>
        <dl className="mt-3 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs text-gray-500">Processed at</dt>
            <dd className="mt-0.5 text-gray-900">{fmt(event.processed_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Process error</dt>
            <dd className="mt-0.5 break-words text-rose-700">
              {event.process_error || <span className="text-gray-400">none</span>}
            </dd>
          </div>
        </dl>
      </section>

      {/* Refund actions */}
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Refund</h2>
        {refundables.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            This event has no charge or payment_intent to refund.
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            {refundables.map((r) => (
              <form
                key={`${r.kind}:${r.id}`}
                action={refundAction}
                className="rounded-md border border-gray-200 p-4"
              >
                <input type="hidden" name="event_id" value={event.id} />
                <input type="hidden" name="target_type" value={r.kind} />
                <input type="hidden" name="target_id" value={r.id} />

                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs text-gray-500">{r.kind}</span>
                    <a
                      href={stripeUrl(r.kind === 'charge' ? 'payments' : 'payments', r.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 font-mono text-sm text-blue-700 hover:underline"
                    >
                      {r.id}
                    </a>
                  </div>
                  <div className="text-xs text-gray-500">
                    Captured: <span className="font-medium text-gray-700">{dollarStr(r.amount, r.currency)}</span>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Amount ($, blank = full)</label>
                    <input
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder={r.amount != null ? (r.amount / 100).toFixed(2) : ''}
                      className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600">Reason</label>
                    <select
                      name="reason"
                      defaultValue=""
                      className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">— none —</option>
                      <option value="requested_by_customer">requested_by_customer</option>
                      <option value="duplicate">duplicate</option>
                      <option value="fraudulent">fraudulent</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      className="w-full rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700"
                    >
                      Issue refund
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Refunds happen live on Stripe ({stripeMode()}). Action is audit-logged with actor and source event.
                </p>
              </form>
            ))}
          </div>
        )}
      </section>

      {/* Payload viewer */}
      <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Event payload</h2>
          <span className="text-xs text-gray-400">JSON · read-only</span>
        </div>
        <pre className="max-h-[600px] overflow-auto bg-gray-900 p-5 text-xs leading-relaxed text-gray-100">
{JSON.stringify(event.payload, null, 2)}
        </pre>
      </section>

      {/* Audit log for this event */}
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Admin actions on this event</h2>
        {(audit?.length ?? 0) === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No admin actions yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100 text-sm">
            {audit!.map((a) => {
              const row = a as { id: number; action: string; actor_email: string | null; metadata: Record<string, unknown> | null; created_at: string }
              return (
                <li key={row.id} className="py-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-gray-700">{row.action}</span>
                    <time className="text-xs text-gray-400">{fmt(row.created_at)}</time>
                  </div>
                  <div className="text-xs text-gray-500">by {row.actor_email ?? 'system'}</div>
                  {row.metadata && Object.keys(row.metadata).length > 0 && (
                    <pre className="mt-1 overflow-x-auto rounded bg-gray-50 p-2 text-[11px] text-gray-600">
{JSON.stringify(row.metadata, null, 2)}
                    </pre>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
