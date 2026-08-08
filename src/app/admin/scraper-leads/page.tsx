import Link from 'next/link'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import SendIntakeButton from './SendIntakeButton'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type ScraperLead = {
  id: string
  run_id: string | null
  business_name: string | null
  business_category: string | null
  services_provided: string[] | null
  social_profile_url: string | null
  has_own_website: boolean | null
  email: string | null
  phone: string | null
  pipeline: string | null
  outreach_rank: string | null
  source: string | null
  created_at: string
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleString()
}

function safeExternalUrl(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

export default async function ScraperLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string; q?: string }>
}) {
  const { run = '', q = '' } = await searchParams
  const admin = getSupabaseAdmin()

  let query = admin
    .from('scraper_leads')
    .select(
      'id, run_id, business_name, business_category, services_provided, social_profile_url, has_own_website, email, phone, pipeline, outreach_rank, source, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(500)

  if (run.trim()) query = query.eq('run_id', run.trim())
  if (q.trim()) {
    const safeSearch = q.trim().replace(/[^a-zA-Z0-9@+._ -]/g, ' ').slice(0, 100)
    const t = `%${safeSearch}%`
    query = query.or(
      `business_name.ilike.${t},business_category.ilike.${t},email.ilike.${t},phone.ilike.${t}`
    )
  }

  const { data: leads, error } = await query

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Scraper leads</h1>
        <p className="mt-4 text-red-600">Failed to load: {error.message}</p>
      </div>
    )
  }

  const rows = (leads ?? []) as ScraperLead[]

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Scraper leads</h1>
          <p className="mt-1 text-sm text-gray-500">
            Outreach records from Maps scraper runs (not widget form submissions).
          </p>
        </div>
        <Link
          href="/admin/leads"
          className="text-sm text-blue-600 hover:underline"
        >
          Widget leads inbox →
        </Link>
      </div>

      <form className="mb-6 flex flex-wrap gap-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name, email, phone…"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          name="run"
          defaultValue={run}
          placeholder="Filter by run_id"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Filter
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Category & services</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Pipeline</th>
              <th className="px-4 py-3">Run</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Intake</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No scraper leads yet. Complete a scraper run to populate this table.
                </td>
              </tr>
            ) : (
              rows.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {lead.business_name ?? '—'}
                    <div className="text-xs font-normal text-gray-400">
                      {lead.has_own_website ? 'Owned website' : 'No owned website'}
                    </div>
                  </td>
                  <td className="max-w-xs px-4 py-3 text-gray-600">
                    <div>{lead.business_category ?? '—'}</div>
                    <div className="mt-1 text-xs text-gray-400">
                      {(lead.services_provided ?? []).join(', ') || 'No services listed'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    <div>{lead.email ?? '—'}</div>
                    <div className="text-xs text-gray-400">{lead.phone ?? ''}</div>
                    {safeExternalUrl(lead.social_profile_url) && (
                      <a
                        href={safeExternalUrl(lead.social_profile_url) ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Social profile
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {lead.pipeline ?? '—'}
                    {lead.outreach_rank != null && (
                      <span className="ml-1 text-xs text-gray-400">
                        (rank {lead.outreach_rank})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {lead.run_id ? (
                      <Link
                        href={`/admin/scraper-leads?run=${encodeURIComponent(lead.run_id)}`}
                        className="text-blue-600 hover:underline"
                      >
                        {lead.run_id.slice(0, 12)}…
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{fmt(lead.created_at)}</td>
                  <td className="px-4 py-3">
                    <SendIntakeButton
                      leadId={lead.id}
                      businessName={lead.business_name}
                      email={lead.email}
                      pipeline={lead.pipeline}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
