'use client'

type Props = {
  sitePublished?: boolean
  siteAlreadyLive?: boolean
  error?: string | null
  tenantSiteUrl?: string | null
  tenantSiteStatus?: string | null
}

const ERROR_MESSAGES: Record<string, string> = {
  launch_not_paid: 'Launch payment is not complete yet.',
  no_contractor: 'No provisioned contractor is linked to this intake.',
  tenant_not_found: 'Tenant record not found for this contractor id.',
  publish_failed: 'Could not publish the site. Check server logs.',
  intake_not_found: 'Intake not found.',
}

export default function IntakeAdminAlerts({
  sitePublished,
  siteAlreadyLive,
  error,
  tenantSiteUrl,
  tenantSiteStatus,
}: Props) {
  const errorMsg = error ? ERROR_MESSAGES[error] ?? `Error: ${error}` : null

  return (
    <div className="mb-6 space-y-3">
      {tenantSiteStatus && (
        <p className="text-sm text-gray-600">
          Tenant site status:{' '}
          <span className="font-medium capitalize text-gray-900">
            {tenantSiteStatus.replace(/_/g, ' ')}
          </span>
          {tenantSiteUrl && tenantSiteUrl !== '#' && (
            <>
              {' '}
              ·{' '}
              <a
                href={tenantSiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Open customer site
              </a>
            </>
          )}
        </p>
      )}

      {sitePublished && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Site is now <strong>active</strong> and publicly viewable
          {tenantSiteUrl && tenantSiteUrl !== '#' ? (
            <>
              {' '}
              —{' '}
              <a
                href={tenantSiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline"
              >
                open site
              </a>
            </>
          ) : null}
          .
        </div>
      )}

      {siteAlreadyLive && !sitePublished && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Site was already published (active). No change needed.
        </div>
      )}

      {errorMsg && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMsg}
        </div>
      )}
    </div>
  )
}
