import Link from 'next/link'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { getIntakePaymentSummary } from '@/lib/intake/intakePaymentStage'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'
import NewIntakeButton from './NewIntakeButton'
import IntakeProvisioningMode from './IntakeProvisioningMode'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Intake = ProspectIntakeRow & {
  created_at: string
  submitted_at: string | null
  provisioning_mode: string
}

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleString() : '—'
}

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-amber-100 text-amber-700',
  built: 'bg-green-100 text-green-700',
  archived: 'bg-gray-100 text-gray-400',
}

export default async function IntakesPage() {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('prospect_intakes')
    .select(
      `id, token, status, business_name, contact_email, contact_phone, service_area,
       created_at, submitted_at, provisioning_mode, intake_tier, deposit_status,
       deposit_paid_cents, deposit_required_cents, tier_total_cents,
       build_paid_at, balance_paid_at, maintenance_plan, preview_approved_at,
       site_live_at, maintenance_started_at, provisioned_contractor_id`
    )
    .order('created_at', { ascending: false })
    .limit(500)

  const rows = (data ?? []) as Intake[]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Prospect intakes</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create an intake link with the prospect&apos;s email to send it automatically, or copy the link manually. Open a submitted intake to pre-fill onboarding.
        </p>
      </div>

      <div className="mb-6">
        <NewIntakeButton />
      </div>

      {error && <p className="mb-4 text-red-600">Failed to load: {error.message}</p>}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Tier</th>
              <th className="px-4 py-3">Deposit</th>
              <th className="px-4 py-3">Payment due</th>
              <th className="px-4 py-3">Provision</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  No intakes yet. Generate a link above and send it to a prospect.
                </td>
              </tr>
            ) : (
              rows.map((it) => {
                const payment = getIntakePaymentSummary(it)
                return (
                  <tr key={it.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <Link href={`/admin/intakes/${it.id}`} className="hover:text-blue-600">
                        {it.business_name ?? '—'}
                      </Link>
                      {it.service_area && <div className="text-xs text-gray-400">{it.service_area}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <div>{it.contact_email ?? '—'}</div>
                      <div className="text-xs text-gray-400">{it.contact_phone ?? ''}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[it.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {it.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{it.intake_tier?.replace('_', ' ') ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {it.intake_tier === 'ai_premium' ? (
                        <span>{it.deposit_status}{it.deposit_paid_cents ? ` ($${(it.deposit_paid_cents / 100).toFixed(0)})` : ''}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-[10rem]">
                      {payment.label}
                    </td>
                    <td className="px-4 py-3">
                      <IntakeProvisioningMode
                        intakeId={it.id}
                        initialMode={it.provisioning_mode === 'manual' ? 'manual' : 'auto'}
                        status={it.status}
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-500">{fmt(it.submitted_at)}</td>
                    <td className="px-4 py-3 space-y-1">
                      <Link
                        href={`/admin/intakes/${it.id}`}
                        className="block text-sm font-medium text-blue-600 hover:underline"
                      >
                        Details
                      </Link>
                      {it.status !== 'draft' && (
                        <Link
                          href={`/admin/sandbox/onboarding?intake=${it.id}`}
                          className="block text-xs text-gray-500 hover:underline"
                        >
                          {it.provisioning_mode === 'manual' ? 'AI build →' : 'Build site →'}
                        </Link>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
