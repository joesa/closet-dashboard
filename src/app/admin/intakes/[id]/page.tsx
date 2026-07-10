import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  buildTenantPreviewUrl,
  getTenantPreviewSiteUrl,
} from '@/lib/admin-preview'
import { getIntakePaymentSummary, isLaunchBuildPaid } from '@/lib/intake/intakePaymentStage'
import { syncTenantLaunchAccess } from '@/lib/intake/syncTenantLaunchAccess'
import { formatUsd } from '@/lib/intake/tiers'
import {
  approvePreviewAction,
  markSiteLiveAction,
  refundDepositAction,
} from './actions'
import IntakeAdminAlerts from './IntakeAdminAlerts'
import IntakeDomainPurchase from '@/components/IntakeDomainPurchase'

export const dynamic = 'force-dynamic'

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleString() : '—'
}

export default async function IntakeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ site_published?: string; site_already_live?: string; error?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('prospect_intakes')
    .select(
      `id, token, status, business_name, contact_email, notification_email,
       intake_tier, tier_total_cents, deposit_status, deposit_paid_cents,
       build_paid_at, balance_paid_at, maintenance_plan, preview_approved_at,
       site_live_at, maintenance_started_at, provisioned_contractor_id, submitted_at,
       ai_site_config, desired_domain`
    )
    .eq('id', id)
    .maybeSingle()

  if (error || !data) redirect('/admin/intakes')

  const payment = getIntakePaymentSummary(
    data as unknown as Parameters<typeof getIntakePaymentSummary>[0]
  )
  const launchPaid = isLaunchBuildPaid(
    data as unknown as Parameters<typeof isLaunchBuildPaid>[0]
  )
  const intakeUrl = `${(process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')}/intake/${data.token}`

  let tenantSiteStatus: string | null = null
  let tenantSiteUrl: string | null = null
  let tenantValidationStatus: string | null = null
  let tenantValidationReport: Array<{code: string; severity: string; message: string; fixable: boolean}> = []
  let tenantValidatedAt: string | null = null
  if (data.provisioned_contractor_id) {
    const synced = await syncTenantLaunchAccess({
      tenantId: data.provisioned_contractor_id,
      intakeId: data.id,
    })
    tenantSiteStatus = synced.siteStatus

    const { data: domainRows } = await admin
      .from('domains')
      .select('hostname, source, is_primary')
      .eq('tenant_id', data.provisioned_contractor_id)
    const rows = Array.isArray(domainRows) ? domainRows : []
    const url = getTenantPreviewSiteUrl(rows)
    tenantSiteUrl = url !== '#' ? url : null

    const { data: tenantRow } = await admin
      .from('tenants')
      .select('validation_status, validation_report, validated_at')
      .eq('id', data.provisioned_contractor_id)
      .maybeSingle()
    tenantValidationStatus = tenantRow?.validation_status ?? null
    tenantValidationReport = Array.isArray(tenantRow?.validation_report) ? tenantRow.validation_report : []
    tenantValidatedAt = tenantRow?.validated_at ?? null
  }

  const needsPublish =
    launchPaid &&
    data.provisioned_contractor_id &&
    tenantSiteStatus !== 'active'

  const bypassUrl =
    tenantSiteUrl && tenantSiteStatus && tenantSiteStatus !== 'active'
      ? buildTenantPreviewUrl(tenantSiteUrl)
      : null

  return (
    <div>
      <IntakeAdminAlerts
        sitePublished={sp.site_published === '1'}
        siteAlreadyLive={sp.site_already_live === '1'}
        error={sp.error ?? null}
        tenantSiteUrl={tenantSiteUrl}
        tenantSiteStatus={tenantSiteStatus}
        bypassUrl={bypassUrl}
      />
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
            {data.intake_tier === 'ai_premium' ? (
              <div className="flex justify-between">
                <dt>Balance paid (launch)</dt>
                <dd>{fmt(data.balance_paid_at)}</dd>
              </div>
            ) : (
              <div className="flex justify-between">
                <dt>Build paid (launch)</dt>
                <dd>{fmt(data.build_paid_at)}</dd>
              </div>
            )}
            {data.intake_tier === 'ai_premium' && data.build_paid_at && (
              <div className="flex justify-between text-xs text-gray-400">
                <dt>Build paid (legacy)</dt>
                <dd>{fmt(data.build_paid_at)}</dd>
              </div>
            )}
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

          {needsPublish && (
            <form action={`/api/admin/intakes/${data.id}/publish-site`} method="POST">
              <button
                type="submit"
                className="w-full rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-600"
              >
                Publish site (launch payment received)
              </button>
            </form>
          )}

          {tenantSiteStatus === 'awaiting_launch_payment' && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              The customer&apos;s domain (including any custom domain) shows a{' '}
              <strong>pay-to-launch</strong> page—not the full site—until launch payment is
              complete. Use admin preview to review the built site.
            </p>
          )}

          {launchPaid && tenantSiteStatus === 'active' && (
            <p className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              Site is <strong>active</strong>.
              {tenantSiteUrl ? (
                <>
                  {' '}
                  <a
                    href={tenantSiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold underline"
                  >
                    View customer site
                  </a>
                </>
              ) : null}
            </p>
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

      <div className="mt-6">
        <IntakeDomainPurchase
          intakeId={data.id}
          desiredDomain={data.desired_domain ?? null}
          tenantId={data.provisioned_contractor_id ?? null}
        />
      </div>

      {data.provisioned_contractor_id && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Site Validation
            </h2>
            <Link
              href={`/admin/sites/${data.provisioned_contractor_id}`}
              className="text-sm font-medium text-indigo-600 hover:underline flex items-center gap-1"
            >
              Open full site details →
            </Link>
          </div>

          {!tenantValidationStatus && (
            <p className="text-sm text-gray-500">Validation has not been run yet. Open site details to run it.</p>
          )}

          {tenantValidationStatus && (
            <>
              <div className="flex items-center gap-3 mb-3">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${
                  tenantValidationStatus === 'passed'
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : tenantValidationStatus === 'failed'
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {tenantValidationStatus === 'passed' && '✓ All checks passed'}
                  {tenantValidationStatus === 'failed' && `✗ ${tenantValidationReport.filter(i => i.severity === 'error').length} error(s) found`}
                  {tenantValidationStatus === 'pending' && '⏳ Validation pending'}
                </span>
                {tenantValidatedAt && (
                  <span className="text-xs text-gray-400">Last checked: {new Date(tenantValidatedAt).toLocaleString()}</span>
                )}
              </div>

              {tenantValidationReport.length > 0 ? (
                <ul className="space-y-2">
                  {tenantValidationReport.map((issue, i) => (
                    <li
                      key={`${issue.code}-${i}`}
                      className={`text-sm rounded-lg border px-4 py-3 ${
                        issue.severity === 'error'
                          ? 'border-red-200 bg-red-50 text-red-700'
                          : 'border-amber-200 bg-amber-50 text-amber-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="font-mono text-xs opacity-60 mr-2">[{issue.code}]</span>
                          {issue.message}
                        </div>
                        {issue.fixable && (
                          <span className="shrink-0 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">AI-fixable</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : tenantValidationStatus === 'passed' ? (
                <p className="text-sm text-green-700">No issues — site is clean and ready for review.</p>
              ) : null}

              <p className="mt-4 text-xs text-gray-400">
                To re-run validation or use the AI auto-fixer, open{' '}
                <Link href={`/admin/sites/${data.provisioned_contractor_id}`} className="text-indigo-600 hover:underline">
                  the full site details page
                </Link>.
              </p>
            </>
          )}
        </div>
      )}

      {data.ai_site_config && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            AI Generated Configuration
          </h2>
          <p className="mt-2 text-sm text-gray-600 mb-4">
            This is the raw site configuration generated by the AI based on the customer&apos;s inputs.
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4 overflow-x-auto">
            <pre className="text-xs text-gray-800 whitespace-pre-wrap">
              {JSON.stringify(data.ai_site_config, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
