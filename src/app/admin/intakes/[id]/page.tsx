import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  buildTenantPreviewUrl,
  buildTenantPreviewUrlFromDomains,
  getTenantLaunchSiteUrl,
} from '@/lib/admin-preview'
import { getIntakePaymentSummary, isLaunchBuildPaid } from '@/lib/intake/intakePaymentStage'
import { syncTenantLaunchAccess } from '@/lib/intake/syncTenantLaunchAccess'
import { formatUsd } from '@/lib/intake/tiers'
import { TEMP_PREVIEW_DURATIONS, isTempPreviewActive } from '@/lib/intake/tempPreviewAccess'
import {
  approvePreviewAction,
  markSiteLiveAction,
  refundDepositAction,
  enableTempPreviewAction,
  disableTempPreviewAction,
  markPaidInFullAction,
  undoPaidInFullAction,
  waiveMaintenanceAction,
  undoWaiveMaintenanceAction,
} from './actions'
import IntakeAdminAlerts from './IntakeAdminAlerts'
import IntakeDomainPurchase from '@/components/IntakeDomainPurchase'
import { publicAppOrigin } from '@/lib/urls'
import { hasCompLaunchPayment, listCompPayments } from '@/lib/intake/markPaidInFull'

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
       site_live_at, maintenance_started_at, maintenance_waived_at,
       provisioned_contractor_id, submitted_at,
       ai_site_config, desired_domain, domain_purchase_requested`
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
  const compPayments = data.status !== 'draft' ? await listCompPayments(data.id) : []
  const launchWasComped = hasCompLaunchPayment(compPayments)
  const maintenanceWaived = Boolean(data.maintenance_waived_at)
  const maintenanceStarted = Boolean(data.maintenance_started_at)
  const intakeUrl = `${publicAppOrigin()}/intake/${data.token}`

  let tenantSiteStatus: string | null = null
  let tenantSiteUrl: string | null = null
  let tenantValidationStatus: string | null = null
  let tenantValidationReport: Array<{code: string; severity: string; message: string; fixable: boolean}> = []
  let tenantValidatedAt: string | null = null
  let tempPreviewExpiresAt: string | null = null
  let domainRows: Array<{
    hostname: string
    source: string
    is_primary: boolean
    vercel_verified?: boolean
    ssl_status?: string | null
    registrar_order_id?: string | null
    purchase_price_cents?: number | null
  }> = []
  if (data.provisioned_contractor_id) {
    const synced = await syncTenantLaunchAccess({
      tenantId: data.provisioned_contractor_id,
      intakeId: data.id,
    })
    tenantSiteStatus = synced.siteStatus

    const { data: domainData } = await admin
      .from('domains')
      .select(
        'hostname, source, is_primary, vercel_verified, ssl_status, registrar_order_id, purchase_price_cents'
      )
      .eq('tenant_id', data.provisioned_contractor_id)
    domainRows = Array.isArray(domainData) ? domainData : []
    const url = getTenantLaunchSiteUrl(domainRows, { launchPaid })
    tenantSiteUrl = url !== '#' ? url : null

    const { data: tenantRow } = await admin
      .from('tenants')
      .select('validation_status, validation_report, validated_at, temp_preview_expires_at')
      .eq('id', data.provisioned_contractor_id)
      .maybeSingle()
    tenantValidationStatus = tenantRow?.validation_status ?? null
    tenantValidationReport = Array.isArray(tenantRow?.validation_report) ? tenantRow.validation_report : []
    tenantValidatedAt = tenantRow?.validated_at ?? null
    tempPreviewExpiresAt = tenantRow?.temp_preview_expires_at ?? null
  }

  const desiredHost = (data.desired_domain || '').trim().toLowerCase()
  const existingDesired = desiredHost
    ? domainRows.find((d) => d.hostname === desiredHost) || null
    : null
  const existingDomainStatus = existingDesired
    ? {
        hostname: existingDesired.hostname,
        source: existingDesired.source,
        isPrimary: existingDesired.is_primary,
        vercelVerified: Boolean(existingDesired.vercel_verified),
        registrarOrderId: existingDesired.registrar_order_id ?? null,
        purchasePriceCents: existingDesired.purchase_price_cents ?? null,
      }
    : null

  const needsPublish =
    launchPaid &&
    data.provisioned_contractor_id &&
    tenantSiteStatus !== 'active'

  const bypassUrl = tenantSiteUrl
    ? buildTenantPreviewUrl(tenantSiteUrl)
    : (data.provisioned_contractor_id ? buildTenantPreviewUrlFromDomains(domainRows) : null)


  const tempPreviewActive = isTempPreviewActive(tempPreviewExpiresAt)

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

          {bypassUrl && (
            <a
              href={bypassUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 shadow-sm"
            >
              <span>🔍 Preview Site (Subdomain Bypass)</span>
            </a>
          )}

          {tenantSiteStatus === 'awaiting_launch_payment' && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              The customer&apos;s domain (including any custom domain) shows a{' '}
              <strong>pay-to-launch</strong> page—not the full site—until launch payment is
              complete. Use admin preview above to review the built site.
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

      {data.provisioned_contractor_id &&
        !launchPaid &&
        (tenantSiteStatus !== 'active' || tempPreviewActive) && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Temporary Preview Access
          </h2>

          {tempPreviewActive ? (
            <>
              <p className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                Temporary preview is <strong>active</strong> — the balance requirement is
                bypassed until <strong>{fmt(tempPreviewExpiresAt)}</strong>, then it reverts to
                requiring payment automatically.
              </p>
              {tenantSiteUrl && (
                <a
                  href={tenantSiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex text-sm font-semibold text-blue-700 hover:underline"
                >
                  Open the client&apos;s view →
                </a>
              )}
              <form action={disableTempPreviewAction} className="mt-3">
                <input type="hidden" name="intake_id" value={data.id} />
                <button
                  type="submit"
                  className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                >
                  Require payment now
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-gray-500">
                Let the client view their built site without paying the balance first. Access
                reverts to requiring payment automatically when the window expires.
              </p>
              <form action={enableTempPreviewAction} className="mt-3 flex items-end gap-3">
                <input type="hidden" name="intake_id" value={data.id} />
                <label className="flex-1 text-sm">
                  <span className="mb-1 block text-gray-600">Duration</span>
                  <select
                    name="hours"
                    defaultValue={24}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    {TEMP_PREVIEW_DURATIONS.map((d) => (
                      <option key={d.hours} value={d.hours}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
                >
                  Temporary Approve
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {data.status !== 'draft' && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Free / comped build
          </h2>
          {launchPaid ? (
            <div className="mt-2 space-y-3">
              <p className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                Launch payment is already settled — the owner will not be asked to pay
                {launchWasComped ? ' (comped / $0 ledger).' : '.'}
              </p>
              {launchWasComped ? (
                <details className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3">
                  <summary className="cursor-pointer text-sm font-medium text-rose-900">
                    Undo mark paid in full…
                  </summary>
                  <p className="mt-2 text-sm text-rose-900">
                    Clears the comp ledger and puts launch payment due again. The public site
                    will return to awaiting-payment access. This only works for comps — not for
                    real Stripe charges.
                  </p>
                  <form action={undoPaidInFullAction} className="mt-3 space-y-3">
                    <input type="hidden" name="intake_id" value={data.id} />
                    <label className="block text-sm">
                      <span className="mb-1 block text-rose-900">Reason (optional, for the audit log)</span>
                      <input
                        type="text"
                        name="reason"
                        placeholder="e.g. owner changed mind — collect payment"
                        className="w-full rounded-md border border-rose-300 bg-white px-3 py-2 text-sm"
                      />
                    </label>
                    <button
                      type="submit"
                      className="w-full rounded-md bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600"
                    >
                      Undo mark paid in full
                    </button>
                  </form>
                </details>
              ) : (
                <p className="text-xs text-gray-500">
                  Settled via Stripe (or another non-comp path) — undo is not available here.
                </p>
              )}
            </div>
          ) : (
            <>
              <p className="mt-2 text-sm text-gray-500">
                Give this build away: marks the launch payment (and any outstanding deposit)
                settled, takes the site live, and expires any open Stripe checkout session so
                the customer can never be charged for it later.
              </p>
              <details className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
                <summary className="cursor-pointer text-sm font-medium text-amber-900">
                  Mark paid in full…
                </summary>
                <p className="mt-2 text-sm text-amber-900">
                  No money moves in Stripe — Stripe has no way to mark a session paid without a
                  real charge. This records the build as comped ($0) in the payment ledger.
                </p>
                <form action={markPaidInFullAction} className="mt-3 space-y-3">
                  <input type="hidden" name="intake_id" value={data.id} />
                  <label className="block text-sm">
                    <span className="mb-1 block text-amber-900">Reason (optional, for the audit log)</span>
                    <input
                      type="text"
                      name="reason"
                      placeholder="e.g. free build for referral partner"
                      className="w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm"
                    />
                  </label>
                  <button
                    type="submit"
                    className="w-full rounded-md bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
                  >
                    Mark paid in full (comp this build)
                  </button>
                </form>
              </details>
            </>
          )}

          <div className="mt-6 border-t border-gray-100 pt-5">
            <h3 className="text-sm font-semibold text-gray-700">Monthly service fees</h3>
            {maintenanceStarted ? (
              <p className="mt-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                Site maintenance has already started
                {data.maintenance_plan ? ` (${data.maintenance_plan})` : ''}. Cancel or change
                the Stripe subscription separately if needed.
              </p>
            ) : maintenanceWaived ? (
              <div className="mt-2 space-y-3">
                <p className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                  Monthly / yearly site maintenance is not required for this intake.
                </p>
                <details className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3">
                  <summary className="cursor-pointer text-sm font-medium text-rose-900">
                    Undo maintenance waiver…
                  </summary>
                  <p className="mt-2 text-sm text-rose-900">
                    Makes the ongoing maintenance checkout required again once the site is live.
                  </p>
                  <form action={undoWaiveMaintenanceAction} className="mt-3 space-y-3">
                    <input type="hidden" name="intake_id" value={data.id} />
                    <label className="block text-sm">
                      <span className="mb-1 block text-rose-900">Reason (optional, for the audit log)</span>
                      <input
                        type="text"
                        name="reason"
                        placeholder="e.g. owner wants to bill maintenance after all"
                        className="w-full rounded-md border border-rose-300 bg-white px-3 py-2 text-sm"
                      />
                    </label>
                    <button
                      type="submit"
                      className="w-full rounded-md bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-600"
                    >
                      Require monthly service fees again
                    </button>
                  </form>
                </details>
              </div>
            ) : (
              <>
                <p className="mt-2 text-sm text-gray-500">
                  By default the owner is asked for ongoing site maintenance after launch. Waive
                  it when this build should not require those monthly / yearly fees.
                </p>
                <details className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
                  <summary className="cursor-pointer text-sm font-medium text-amber-900">
                    Do not require monthly service fees…
                  </summary>
                  <p className="mt-2 text-sm text-amber-900">
                    Skips the maintenance checkout for this intake. You can undo this later if
                    the owner changes their mind.
                  </p>
                  <form action={waiveMaintenanceAction} className="mt-3 space-y-3">
                    <input type="hidden" name="intake_id" value={data.id} />
                    <label className="block text-sm">
                      <span className="mb-1 block text-amber-900">Reason (optional, for the audit log)</span>
                      <input
                        type="text"
                        name="reason"
                        placeholder="e.g. included in partnership deal"
                        className="w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm"
                      />
                    </label>
                    <button
                      type="submit"
                      className="w-full rounded-md bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
                    >
                      Waive monthly service fees
                    </button>
                  </form>
                </details>
              </>
            )}
          </div>
        </div>
      )}

      <div className="mt-6">
        <IntakeDomainPurchase
          intakeId={data.id}
          desiredDomain={data.desired_domain ?? null}
          purchaseRequested={Boolean(data.domain_purchase_requested)}
          tenantId={data.provisioned_contractor_id ?? null}
          existingDomain={existingDomainStatus}
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
