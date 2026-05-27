import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { extendTrialAction, compAction, markCanceledAction } from './actions'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Contractor = {
  id: string
  company_name: string | null
  contact_email: string | null
  contact_phone: string | null
  subscription_status: string | null
  subscription_plan: string | null
  trial_ends_at: string | null
  current_period_end: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  created_at: string
  updated_at: string | null
  user_id: string | null
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString()
}

function statusBadge(s: string | null) {
  const map: Record<string, string> = {
    active:    'bg-green-100 text-green-800',
    trialing:  'bg-blue-100 text-blue-800',
    comp:      'bg-purple-100 text-purple-800',
    past_due:  'bg-amber-100 text-amber-800',
    canceled:  'bg-gray-200 text-gray-700',
    incomplete:'bg-rose-100 text-rose-800',
  }
  const cls = map[s ?? ''] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>
      {s ?? 'unknown'}
    </span>
  )
}

function stripeMode(): 'live' | 'test' {
  return (process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_live_') ? 'live' : 'test'
}

function stripeLink(kind: 'customers' | 'subscriptions', id: string | null) {
  if (!id) return null
  const prefix = stripeMode() === 'live' ? 'https://dashboard.stripe.com' : 'https://dashboard.stripe.com/test'
  return `${prefix}/${kind}/${id}`
}

export default async function ContractorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const admin = getSupabaseAdmin()

  const { data: contractor } = await admin
    .from('contractor_settings')
    .select(
      'id, company_name, contact_email, contact_phone, subscription_status, subscription_plan, trial_ends_at, current_period_end, stripe_customer_id, stripe_subscription_id, created_at, updated_at, user_id'
    )
    .eq('id', id)
    .maybeSingle()

  if (!contractor) notFound()
  const c = contractor as Contractor

  const [{ data: leads }, { data: quotes }, { data: audit }, { count: leadCount }, { count: quoteCount }] = await Promise.all([
    admin
      .from('leads')
      .select('id, first_name, last_name, email, phone, estimated_total, room_type, finish_type, created_at')
      .eq('contractor_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
    admin
      .from('quote_events')
      .select('id, estimated_total, room_type, finish_type, linear_feet, created_at')
      .eq('contractor_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
    admin
      .from('admin_audit_log')
      .select('id, action, actor_email, metadata, created_at')
      .eq('target_id', id)
      .order('created_at', { ascending: false })
      .limit(15),
    admin
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('contractor_id', id),
    admin
      .from('quote_events')
      .select('id', { count: 'exact', head: true })
      .eq('contractor_id', id),
  ])

  const conversion = quoteCount && quoteCount > 0
    ? ((leadCount ?? 0) / quoteCount) * 100
    : null

  const custLink = stripeLink('customers', c.stripe_customer_id)
  const subLink = stripeLink('subscriptions', c.stripe_subscription_id)

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/contractors" className="text-xs text-blue-600 hover:underline">
          ← Contractors
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-gray-900">
            {c.company_name || '(unnamed)'}
          </h1>
          {statusBadge(c.subscription_status)}
          {c.subscription_plan && (
            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
              {c.subscription_plan}
            </span>
          )}
        </div>
        <div className="mt-1 text-sm text-gray-500">
          {c.contact_email || '—'}{c.contact_phone ? ` · ${c.contact_phone}` : ''}
        </div>
        <div className="mt-0.5 font-mono text-xs text-gray-400">{c.id}</div>
      </div>

      {/* Subscription panel */}
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Subscription</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-gray-500">Status</dt>
            <dd className="mt-0.5 font-medium text-gray-900">{c.subscription_status ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Plan</dt>
            <dd className="mt-0.5 font-medium text-gray-900">{c.subscription_plan ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Trial ends</dt>
            <dd className="mt-0.5 text-gray-900">{fmt(c.trial_ends_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Period ends</dt>
            <dd className="mt-0.5 text-gray-900">{fmt(c.current_period_end)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Joined</dt>
            <dd className="mt-0.5 text-gray-900">{fmt(c.created_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Updated</dt>
            <dd className="mt-0.5 text-gray-900">{fmt(c.updated_at)}</dd>
          </div>
          <div className="sm:col-span-3">
            <dt className="text-xs text-gray-500">Stripe</dt>
            <dd className="mt-0.5 space-x-3 text-sm">
              {custLink ? (
                <a href={custLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  customer ↗
                </a>
              ) : <span className="text-gray-400">no customer</span>}
              {subLink ? (
                <a href={subLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  subscription ↗
                </a>
              ) : <span className="text-gray-400">no subscription</span>}
              <span className="font-mono text-xs text-gray-400">{stripeMode()}</span>
            </dd>
          </div>
        </dl>
      </section>

      {/* Activity stats */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gray-500">Leads</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">{leadCount ?? 0}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gray-500">Quote calcs</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">{quoteCount ?? 0}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gray-500">Conversion</div>
          <div className="mt-2 text-2xl font-semibold text-gray-900">
            {conversion != null ? `${conversion.toFixed(1)}%` : '—'}
          </div>
          <div className="mt-1 text-xs text-gray-400">leads ÷ quotes</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gray-500">User ID</div>
          <div className="mt-2 truncate font-mono text-xs text-gray-700">{c.user_id ?? '—'}</div>
        </div>
      </section>

      {/* Admin actions */}
      <section className="grid gap-4 lg:grid-cols-3">
        <form
          action={extendTrialAction}
          className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
        >
          <input type="hidden" name="contractor_id" value={c.id} />
          <h3 className="text-sm font-semibold text-gray-900">Extend trial</h3>
          <p className="mt-1 text-xs text-gray-500">
            Adds days to the later of now and the current trial end. Sets status to trialing.
          </p>
          <label className="mt-3 block text-xs font-medium text-gray-600">Days</label>
          <select
            name="days"
            defaultValue="14"
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="7">+7</option>
            <option value="14">+14</option>
            <option value="30">+30</option>
            <option value="60">+60</option>
            <option value="90">+90</option>
          </select>
          <button
            type="submit"
            className="mt-3 w-full rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Extend trial
          </button>
        </form>

        <form
          action={compAction}
          className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
        >
          <input type="hidden" name="contractor_id" value={c.id} />
          <h3 className="text-sm font-semibold text-gray-900">Comp account</h3>
          <p className="mt-1 text-xs text-gray-500">
            Sets status to <code>comp</code> and extends current_period_end.
          </p>
          <label className="mt-3 block text-xs font-medium text-gray-600">Months</label>
          <select
            name="months"
            defaultValue="3"
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="1">1 month</option>
            <option value="3">3 months</option>
            <option value="6">6 months</option>
            <option value="12">12 months</option>
            <option value="24">24 months</option>
          </select>
          <label className="mt-3 block text-xs font-medium text-gray-600">Reason (optional)</label>
          <input
            name="reason"
            type="text"
            maxLength={280}
            placeholder="Founder gift, refund credit…"
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            className="mt-3 w-full rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700"
          >
            Apply comp
          </button>
        </form>

        <form
          action={markCanceledAction}
          className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
        >
          <input type="hidden" name="contractor_id" value={c.id} />
          <h3 className="text-sm font-semibold text-gray-900">Mark canceled</h3>
          <p className="mt-1 text-xs text-gray-500">
            Flips status to <code>canceled</code> in our DB. Optionally cancels the live Stripe subscription.
          </p>
          <label className="mt-3 block text-xs font-medium text-gray-600">Reason (optional)</label>
          <input
            name="reason"
            type="text"
            maxLength={280}
            placeholder="Requested by owner, fraud…"
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
          <label className="mt-3 flex items-center gap-2 text-xs text-gray-700">
            <input
              type="checkbox"
              name="cancel_in_stripe"
              disabled={!c.stripe_subscription_id}
            />
            Also cancel in Stripe
            {!c.stripe_subscription_id && (
              <span className="text-gray-400">(no sub on file)</span>
            )}
          </label>
          <button
            type="submit"
            className="mt-3 w-full rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700"
          >
            Mark canceled
          </button>
        </form>
      </section>

      {/* Recent leads */}
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Recent leads</h2>
          <Link href="/admin/leads" className="text-xs text-blue-600 hover:underline">All leads →</Link>
        </div>
        {(leads?.length ?? 0) === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No leads yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100 text-sm">
            {leads!.map((l) => {
              const row = l as { id: string; first_name: string | null; last_name: string | null; email: string | null; phone: string | null; estimated_total: number | null; room_type: string | null; finish_type: string | null; created_at: string }
              const fullName = [row.first_name, row.last_name].filter(Boolean).join(' ').trim()
              return (
                <li key={row.id} className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-medium text-gray-900">{fullName || row.email || '(unknown)'}</div>
                    <div className="text-xs text-gray-500">
                      {[row.email, row.phone].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-gray-900">
                      {row.estimated_total != null ? `$${Number(row.estimated_total).toLocaleString()}` : '—'}
                    </div>
                    <div className="text-xs text-gray-400">
                      {[row.room_type, row.finish_type].filter(Boolean).join(' / ')}
                    </div>
                    <div className="text-xs text-gray-400">{fmt(row.created_at)}</div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Recent quotes */}
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Recent quote calculations</h2>
        {(quotes?.length ?? 0) === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No quote events yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100 text-sm">
            {quotes!.map((q) => {
              const row = q as { id: number; estimated_total: number | null; room_type: string | null; finish_type: string | null; linear_feet: number | null; created_at: string }
              return (
                <li key={row.id} className="flex items-center justify-between py-2 text-gray-700">
                  <div>
                    <span>${row.estimated_total != null ? Number(row.estimated_total).toLocaleString() : '—'}</span>
                    <span className="ml-3 text-xs text-gray-500">
                      {[row.room_type, row.finish_type, row.linear_feet ? `${row.linear_feet}ft` : null].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <time className="text-xs text-gray-400">{fmt(row.created_at)}</time>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Audit log for this contractor */}
      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Admin actions on this account</h2>
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
