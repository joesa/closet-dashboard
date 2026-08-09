import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { specBuildDeletionBlockReason } from '@/lib/spec/specBuilds'
import { SPEC_BUILD_SELECT, type SpecBuildRow, type SpecFact } from '@/lib/spec/types'
import { firecrawlConfigured } from '@/lib/spec/research/fetchPage'
import { resolveResearchSources } from '@/lib/spec/research/sources'
import { ADMIN_FACT_FIELDS } from '@/lib/spec/addAdminFact'
import {
  addFactAction,
  advanceSpecBuildAction,
  approveSpecBuildAction,
  rejectSpecBuildAction,
  runResearchAction,
} from '../actions'
import { offerUrl, priceSpecOffer } from '@/lib/spec/specOffer'
import { SPEC_OFFER_SMS_TEMPLATES, personalizeTemplate } from '@/lib/twilio-sms'
import { specSmsAllowed, specSmsAllowlist } from '@/lib/spec/specSmsAllowlist'

/** Plain-language prompts — the column names mean nothing to a person on a call. */
const ADMIN_FACT_LABELS: Record<string, string> = {
  craft_spec: 'What they measure, and to what tolerance',
  shop_rule: 'A rule they never break',
  local_conditions: 'What goes wrong on local jobs',
  crew_shape: 'Who actually does the work',
  client_artifact: 'What the customer receives',
  recent_job: 'A real recent job',
  competitor_tell: 'What cheaper competitors get wrong',
  timeline_facts: 'Real timeframes',
  guarantee_terms: 'Their guarantee, in their words',
  signature_materials: 'Named materials, brands or equipment',
}
import DeleteSpecBuildButton from '../DeleteSpecBuildButton'

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
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ fact_error?: string; fact_added?: string; advanced?: string }>
}) {
  const { id } = await params
  const {
    fact_error: factError,
    fact_added: factAdded,
    advanced,
  } = await searchParams
  const { data } = await getSupabaseAdmin()
    .from('spec_builds')
    .select(SPEC_BUILD_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (!data) notFound()
  const build = data as SpecBuildRow
  const lead = build.lead_input ?? { businessName: '', phone: '' }
  const facts: SpecFact[] = build.research?.facts ?? []
  const fetched = build.research?.fetched ?? []
  const rejected =
    (build.research as { rejected?: { reason: string; field?: string; value?: string }[] })
      ?.rejected ?? []
  const sources = resolveResearchSources(lead)

  const offerPricing = priceSpecOffer(build.offer_discount_bps)
  const allowlistActive = specSmsAllowlist().length > 0
  const smsAllowed = specSmsAllowed(build.phone_e164)
  const previewSms = personalizeTemplate(SPEC_OFFER_SMS_TEMPLATES[0].body, {
    businessName: build.business_name,
    offerUrl: offerUrl(build.offer_token ?? '<offer-link>'),
    offerLabel: offerPricing.offerLabel,
    listLabel: offerPricing.listLabel,
    percentOff: String(offerPricing.percentOff),
    deadlineLabel: build.offer_deadline_at
      ? new Date(build.offer_deadline_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
      : '<deadline>',
  })

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

      {factError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {factError}
        </div>
      )}
      {advanced && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {advanced}
        </div>
      )}
      {factAdded && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {factAdded === 'drafting'
            ? 'Fact added. The build now has a concrete claim and has moved to drafting.'
            : 'Fact stored, but it will not get this build past the copy gate. That check counts only a measurement with a unit ("above 1% sodium hypochlorite", "6–8 weeks") or a named thing (a brand, material, street or neighbourhood). Add one more fact with a number or a name in it.'}
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
            {build.research_at
              ? 'Research ran but found nothing verifiable. A site built from this would fail the copy gate.'
              : 'No research yet.'}
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
                    {/*
                      An admin fact has no page to link to — its provenance is a
                      person and a note. Showing both is what lets a later
                      reviewer tell a claim we read off a page from one a
                      colleague vouched for.
                    */}
                    {fact.sourceKind === 'admin_manual' ? (
                      <div className="text-xs">
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 font-medium text-purple-700">
                          added by hand
                        </span>
                        <p className="mt-1 text-gray-600">{fact.note}</p>
                        {fact.addedBy && <p className="text-gray-500">— {fact.addedBy}</p>}
                      </div>
                    ) : (
                      <a
                        href={fact.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {fact.sourceKind}
                      </a>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {fact.sourceKind === 'admin_manual' ? (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                        vouched
                      </span>
                    ) : fact.verbatim ? (
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

      {/*
        The escape hatch. Most cold leads publish nothing verifiable, so without
        a way to write down what the owner says on the phone those builds are
        simply dead. Testimonials are absent from the field list on purpose: an
        admin can authorise the business's own claims, not a customer's words.
      */}
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Add a fact by hand
        </h2>
        <p className="mb-4 text-sm text-gray-600">
          For anything the business told you directly. It goes in the ledger with your name and
          your note, so whoever reviews the finished site can see it came from a person rather
          than a page.
        </p>
        <form action={addFactAction} className="space-y-3">
          <input type="hidden" name="spec_build_id" value={build.id} />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                What kind of fact
              </span>
              <select
                name="field"
                required
                defaultValue="craft_spec"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {ADMIN_FACT_FIELDS.map((field) => (
                  <option key={field} value={field}>
                    {ADMIN_FACT_LABELS[field] ?? field}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm md:col-span-2">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                In their words
              </span>
              <input
                name="value"
                required
                placeholder="We never soft-wash cedar above 1% sodium hypochlorite"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Where did you get this? (required)
            </span>
            <input
              name="note"
              required
              minLength={15}
              placeholder="Owner told me on a call, 9 Aug — he brought it up unprompted"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Add fact
          </button>
        </form>
      </section>

      {/*
        What was read and what was thrown away. This is how you tell "the
        business is quiet online" apart from "the extractor is broken" — the
        two look identical if you only ever see the accepted facts.
      */}
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Sources read
        </h2>
        {sources.length === 0 && (
          <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            This lead has neither a Google Maps listing nor a Facebook page, so there is nothing
            to research. Add one on the lead, or drop it.
          </p>
        )}
        {!firecrawlConfigured() && (
          <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <code className="font-mono">FIRECRAWL_API_KEY</code> is not set — no page can be read.
          </p>
        )}
        <ul className="space-y-1 text-sm">
          {sources.map((source) => {
            const hit = fetched.find((f) => f.url === source.url)
            return (
              <li key={source.url} className="flex flex-wrap items-baseline gap-2">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {source.sourceKind}
                </a>
                <span className="text-gray-500">{source.rationale}</span>
                {hit && (
                  <span className={hit.error ? 'text-red-600' : 'text-emerald-700'}>
                    {hit.error ? hit.error : `${hit.chars.toLocaleString()} chars read`}
                  </span>
                )}
              </li>
            )
          })}
        </ul>

        {rejected.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-gray-700">
              {rejected.length} candidate fact(s) rejected
            </summary>
            <ul className="mt-2 space-y-1 text-xs text-gray-600">
              {rejected.slice(0, 25).map((r, i) => (
                <li key={i}>
                  <span className="font-mono">{r.reason}</span>
                  {r.field ? ` · ${r.field}` : ''} — {r.value}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <form action={runResearchAction}>
            <input type="hidden" name="spec_build_id" value={build.id} />
            <button
              type="submit"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              {build.research_at ? 'Re-run research' : 'Run research'}
            </button>
          </form>
          {['drafting', 'imaging'].includes(build.status) && (
            <form action={advanceSpecBuildAction}>
              <input type="hidden" name="spec_build_id" value={build.id} />
              <button
                type="submit"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
              >
                {build.status === 'drafting' ? 'Generate the site' : 'Generate images'}
              </button>
            </form>
          )}
          {build.status === 'ready_for_review' && (
            <form action={approveSpecBuildAction}>
              <input type="hidden" name="spec_build_id" value={build.id} />
              <button
                type="submit"
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                Approve &amp; start the offer
              </button>
            </form>
          )}
          <form action={rejectSpecBuildAction}>
            <input type="hidden" name="spec_build_id" value={build.id} />
            <button
              type="submit"
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Reject
            </button>
          </form>
          <DeleteSpecBuildButton
            buildId={build.id}
            businessName={build.business_name}
            variant="detail"
            disabledReason={deleteDisabledReason(build)}
          />
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Research reads public pages and writes the intake row. It does not build a site,
          generate images, or contact anyone.
        </p>
      </section>

      {/*
        Everything the business will receive, shown before anyone approves. The
        exact SMS body matters most: it is the only thing here a stranger
        actually reads, and the last chance to catch a wrong number or a
        mangled price.
      */}
      <section className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">
          The offer
        </h2>
        <p className="mb-4 text-sm text-gray-600">
          What gets sent, and to whom, once this build is approved.
        </p>
        <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="List price" value={offerPricing.listLabel} />
          <Field
            label={`Offer (${offerPricing.percentOff}% off)`}
            value={offerPricing.offerLabel}
          />
          <Field label="Deadline" value={fmt(build.offer_deadline_at)} />
          <Field label="Sent at" value={fmt(build.offer_sent_at)} />
        </dl>

        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-gray-500">
          Exact message to {build.phone_e164}
        </p>
        <pre className="mt-1 whitespace-pre-wrap rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
{previewSms}
        </pre>

        {!smsAllowed && (
          <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <strong className="font-medium">This number is not on the SMS allowlist</strong>, so
            nothing will actually be sent. Clear <code className="font-mono">
            SPEC_BUILD_SMS_ALLOWLIST</code> to text real businesses.
          </p>
        )}
        {allowlistActive && smsAllowed && (
          <p className="mt-3 text-xs text-gray-500">
            SMS allowlist is active and this number is on it.
          </p>
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
          Site generation, images and the offer arrive with Phase 3 and 4. Nothing in this queue
          can build a site or contact a business yet.
        </p>
      </section>
    </div>
  )
}

function deleteDisabledReason(
  build: Pick<SpecBuildRow, 'status' | 'tenant_id'>
): string | null {
  const reason = specBuildDeletionBlockReason(build)
  if (reason === 'in_flight') return 'Cannot delete while this build is processing.'
  if (reason === 'tenant_exists') return 'Delete the provisioned tenant from Sites instead.'
  return null
}
