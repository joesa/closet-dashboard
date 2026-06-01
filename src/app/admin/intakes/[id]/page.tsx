import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getIntakePaymentSummary } from '@/lib/intake/intakePaymentStage'
import { formatUsd } from '@/lib/intake/tiers'
import {
  approvePreviewAction,
  markSiteLiveAction,
  refundDepositAction,
} from './actions'

export const dynamic = 'force-dynamic'

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleString() : '—'
}

export default async function IntakeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('prospect_intakes')
    .select(
      `id, token, status, business_name, contact_email, notification_email,
       intake_tier, tier_total_cents, deposit_status, deposit_paid_cents,
       build_paid_at, balance_paid_at, maintenance_plan, preview_approved_at,
       site_live_at, maintenance_started_at, provisioned_contractor_id, submitted_at`
    )
    .eq('id', id)
    .maybeSingle()

  if (error || !data) notFound()

  const payment = getIntakePaymentSummary(
    data as unknown as Parameters<typeof getIntakePaymentSummary>[0]
  )
  const intakeUrl = `${(process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')}/intake/${data.token}`

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/intakes" className="text-sm text-blue-600 hover:underline">
          ← All intakes
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-gray-900">
          {data.business_name ?? 'Intake'}
        </h1>
        <p className="text-sm text-gray-500">
          {data.contact_email ?? data.notification_email ?? 'No email'} ·{' '}
          <span className="capitalize">{data.intake_tier?.replace('_', ' ')}</span> · {data.status}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Payment status
          </h2>
          <p className="mt-2 text-lg font-medium text-gray-900">{payment.label}</p>
          <dl className="mt-4 space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <dt>Build total</dt>
              <dd>{formatUsd(data.tier_total_cents ?? 0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Deposit</dt>
              <dd>{data.deposit_status}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Build paid</dt>
              <dd>{fmt(data.build_paid_at)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Balance paid</dt>
              <dd>{fmt(data.balance_paid_at)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Maintenance plan</dt>
              <dd>{data.maintenance_plan ?? '—'}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Maintenance started</dt>
              <dd>{fmt(data.maintenance_started_at)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-gray-500 break-all">
            Customer link:{' '}
            <a href={intakeUrl} className="text-blue-600 hover:underline">
              {intakeUrl}
            </a>
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Admin actions
          </h2>

          {!data.preview_approved_at && data.status !== 'draft' && (
            <form action={approvePreviewAction}>
              <input type="hidden" name="intake_id" value={data.id} />
              <button
                type="submit"
                className="w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Mark preview approved &amp; email pay link
              </button>
            </form>
          )}

          {data.preview_approved_at && !data.site_live_at && (
            <form action={markSiteLiveAction}>
              <input type="hidden" name="intake_id" value={data.id} />
              <button
                type="submit"
                className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
              >
                Mark site live (unlock maintenance checkout)
              </button>
            </form>
          )}

          {data.deposit_status === 'paid' && (
            <form action={refundDepositAction}>
              <input type="hidden" name="intake_id" value={data.id} />
              <button
                type="submit"
                className="w-full rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                Refund AI Premium deposit
              </button>
            </form>
          )}

          {data.status !== 'draft' && (
            <Link
              href={`/admin/sandbox/onboarding?intake=${data.id}`}
              className="block text-center text-sm font-medium text-blue-600 hover:underline"
            >
              Open build / onboarding →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
