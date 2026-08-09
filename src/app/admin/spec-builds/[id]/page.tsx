import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { SPEC_BUILD_SELECT, type SpecBuildRow, type SpecFact } from '@/lib/spec/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function fmt(d?: string | null): string {
  return d ? new Date(d).toLocaleString() : '—'
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{value || '—'}</dd>
    </div>
  )
}

export default async function SpecBuildDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { data } = await getSupabaseAdmin()
    .from('spec_builds')
    .select(SPEC_BUILD_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (!data) notFound()
  const build = data as SpecBuildRow
  const lead = build.lead_input ?? { businessName: '', phone: '' }
  const facts: SpecFact[] = build.research?.facts ?? []

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/spec-builds" className="text-sm text-blue-600 hover:underline">
          ← All spec builds
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-gray-900">{build.business_name}</h1>
        <p className="mt-1 text-sm text-gray-600">
          {build.status.replace(/_/g, ' ')} · queued {fmt(build.created_at)} · from{' '}
          {build.lead_source}
        </p>
      </div>

      {(build.last_error || build.status_reason) && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {build.status_reason && <p className="font-medium">{build.status_reason}</p>}
          {build.last_error && <p className="mt-1 font-mono text-xs">{build.last_error}</p>}
        </div>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Lead</h2>
        <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Field label="Phone" value={build.phone_e164} />
          <Field label="City" value={build.city} />
          <Field label="Email" value={lead.email} />
          <Field label="Services" value={(lead.services ?? []).join(', ')} />
          <Field label="Category" value={lead.businessCategory} />
          <Field label="Address" value={lead.address} />
          <Field
            label="Facebook"
            value={
              lead.socialProfileUrl ? (
                <a
                  href={lead.socialProfileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {lead.socialProfileUrl}
                </a>
              ) : null
            }
          />
          <Field
            label="Google Maps"
            value={
              lead.mapsPlaceUrl ? (
                <a
                  href={lead.mapsPlaceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Listing
                </a>
              ) : null
            }
          />
          <Field label="Scraper run" value={build.scraper_run_id} />
        </dl>
      </section>

      {/*
        The fact ledger is the non-fabrication audit trail: every claim the site
        makes about this business, with the evidence and the URL it came from.
        Research lands here in Phase 2 — until then it is legitimately empty.
      */}
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Verified facts
        </h2>
        <p className="mb-4 text-sm text-gray-600">
          Every claim the generated site is allowed to make, with the source it was taken from.
          Anything not listed here cannot reach the site copy.
        </p>
        {facts.length === 0 ? (
          <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
            No research yet.
          </p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Field</th>
                <th className="px-3 py-2">Value</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Verbatim</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {facts.map((fact, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 font-mono text-xs text-gray-700">{fact.field}</td>
                  <td className="px-3 py-2 text-gray-900">{fact.value}</td>
                  <td className="px-3 py-2">
                    <a
                      href={fact.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {fact.sourceKind}
                    </a>
                  </td>
                  <td className="px-3 py-2">
                    {fact.verbatim ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        verbatim
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        paraphrased
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Pipeline
        </h2>
        <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Intake" value={build.intake_id} />
          <Field label="Tenant" value={build.tenant_id} />
          <Field label="Attempts" value={String(build.attempts)} />
          <Field label="Researched" value={fmt(build.research_at)} />
        </dl>
        <p className="mt-4 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
          Build, review and offer actions arrive with Phase 3 and 4. Nothing in this queue can
          contact a business yet.
        </p>
      </section>
    </div>
  )
}
