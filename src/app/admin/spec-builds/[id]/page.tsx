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
  updateResearchSourcesAction,
} from '../actions'
import { offerUrl, priceSpecOffer } from '@/lib/spec/specOffer'
import { derivePreviewPassword } from '@/lib/spec/specPreviewPassword'
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

/** States where the worker is (or should be) carrying the build forward. */
const IN_PROGRESS_STATUSES: string[] = [
  'queued',
  'researching',
  'drafting',
  'imaging',
  'provisioning',
  'building',
]

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
  searchParams: Promise<{
    fact_error?: string
    fact_added?: string
    advanced?: string
    sent?: string
    source_error?: string
    sources_updated?: string
  }>
}) {
  const { id } = await params
  const {
    fact_error: factError,
    fact_added: factAdded,
    advanced,
    sent,
    source_error: sourceError,
    sources_updated: sourcesUpdated,
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

  // The password is derived, never stored, so the admin page can show it in
  // plain text whenever it is needed — for reading down the phone if a business
  // loses the text, or for checking the site yourself. It only throws if
  // SPEC_PREVIEW_SECRET is unset, which is a configuration problem worth
  // surfacing rather than hiding behind a blank.
  let previewPassword: string | null = null
  let previewPasswordError: string | null = null
  try {
    previewPassword = derivePreviewPassword(build.id)
  } catch (err) {
    previewPasswordError = err instanceof Error ? err.message : 'Could not derive the password.'
  }

  // Whether the site is actually locked right now. Set at approval, cleared on
  // acceptance — so this is also how you tell an accepted build from an
  // approved one at a glance.
  let previewLockActive = false
  if (build.tenant_id) {
    const { data: cfg } = await getSupabaseAdmin()
      .from('site_configs')
      .select('spec_preview_password_hash')
      .eq('tenant_id', build.tenant_id)
      .maybeSingle()
    previewLockActive = !!(cfg as { spec_preview_password_hash?: string | null } | null)
      ?.spec_preview_password_hash
  }

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
    previewPassword: previewPassword ?? '<password>',
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
      {sourceError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {sourceError}
        </div>
      )}
      {sourcesUpdated && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Sources saved and research rerun.
        </div>
      )}
      {sent && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            sent === 'yes'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          {sent === 'yes'
            ? 'Approved, and the message has been sent.'
            : sent === 'outside_window'
              ? 'Approved. It is outside the send window (Mon–Fri, 9–5 Central), so the message goes out at the next opportunity.'
              : sent === 'not_allowlisted'
                ? 'Approved, but this number is not on SPEC_BUILD_SMS_ALLOWLIST, so nothing was sent.'
                : sent === 'suppressed'
                  ? 'Approved, but this number has opted out. Nothing was sent, and nothing will be.'
                  : sent === 'already_sent'
                    ? 'Approved. This message had already been sent, so it was not sent again.'
                    : `Approved, but the message did not send (${sent}).`}
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
          <Field
            label="Yelp"
            value={
              lead.yelpUrl ? (
                <a
                  href={lead.yelpUrl}
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

      {!build.tenant_id && ['queued', 'needs_attention'].includes(build.status) && (
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Research sources
          </h2>
          <p className="mb-4 text-sm text-gray-600">
            Use whichever listing is current. Saving reruns research and keeps facts added by hand.
          </p>
          <form action={updateResearchSourcesAction} className="space-y-3">
            <input type="hidden" name="spec_build_id" value={build.id} />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                  Facebook URL
                </span>
                <input
                  name="facebook_url"
                  type="url"
                  defaultValue={lead.socialProfileUrl ?? ''}
                  placeholder="https://www.facebook.com/business"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                  Yelp business URL
                </span>
                <input
                  name="yelp_url"
                  type="url"
                  defaultValue={lead.yelpUrl ?? ''}
                  placeholder="https://www.yelp.com/biz/business-city"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <button
              type="submit"
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Save &amp; research
            </button>
          </form>
        </section>
      )}

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
            This lead has no Google Maps, Facebook, or Yelp page, so there is nothing
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
          {['queued', 'drafting', 'imaging'].includes(build.status) && (
            <form action={advanceSpecBuildAction}>
              <input type="hidden" name="spec_build_id" value={build.id} />
              <button
                type="submit"
                className="rounded-md border border-blue-300 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                Run the next step now
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
        {IN_PROGRESS_STATUSES.includes(build.status) ? (
          <p className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            <strong className="font-medium">This build is running.</strong> It carries on by
            itself — research, site copy, images, then provisioning — and stops at{' '}
            <em>ready for review</em>, where it waits for you. Refresh to see where it has got
            to. &ldquo;Run the next step now&rdquo; is only needed if the background worker is
            not running.
          </p>
        ) : (
          <p className="mt-3 text-xs text-gray-500">
            Nothing here contacts the business. That happens only after you approve.
          </p>
        )}
      </section>

      {/*
        The send card. The exact message, the number it goes to, and the button
        sit together on purpose: the decision being made is "send this text to
        this stranger", so the thing being approved has to be in front of you
        when you approve it — not in a panel further down the page.
      */}
      {build.status === 'ready_for_review' && (
        <section className="rounded-lg border-2 border-emerald-300 bg-emerald-50/40 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
            Review the message, then send
          </h2>
          <p className="mt-1 text-sm text-gray-700">
            Nothing has been sent to this business. Pressing the button below texts them the
            message exactly as written here.
          </p>

          <dl className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Field label="To" value={build.phone_e164} />
            <Field label="Business" value={build.business_name} />
            <Field label="They pay" value={offerPricing.offerLabel} />
            <Field label="Site password" value={previewPassword ?? '—'} />
          </dl>

          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-gray-500">
            Exact message
          </p>
          <pre className="mt-1 whitespace-pre-wrap rounded-md border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900">
{previewSms}
          </pre>

          {!smsAllowed ? (
            <p className="mt-4 rounded-md border border-amber-300 bg-amber-100 px-3 py-2 text-sm text-amber-900">
              <strong className="font-medium">This number is not on the SMS allowlist.</strong>{' '}
              Approving will mint the offer but send nothing. Clear{' '}
              <code className="font-mono">SPEC_BUILD_SMS_ALLOWLIST</code> to text real businesses.
            </p>
          ) : (
            <p className="mt-4 text-sm text-gray-700">
              This is a real text to a real business. It cannot be unsent.
            </p>
          )}

          <form action={approveSpecBuildAction} className="mt-4">
            <input type="hidden" name="spec_build_id" value={build.id} />
            <button
              type="submit"
              className="rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              {smsAllowed ? 'Approve & send this message' : 'Approve (nothing will be sent)'}
            </button>
          </form>
        </section>
      )}

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

        <div className="mt-5 rounded-md border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Site password
          </p>
          {previewPasswordError ? (
            <p className="mt-1 text-sm text-red-700">{previewPasswordError}</p>
          ) : (
            <>
              <p className="mt-1 font-mono text-xl tracking-widest text-gray-900">
                {previewPassword}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                {previewLockActive ? (
                  <>
                    The site is locked. Only someone with this password can open it — read it
                    down the phone if they lose the text. It is removed automatically when they
                    accept and the site goes live.
                  </>
                ) : (
                  <>
                    Not applied yet. The lock goes on when you approve this build, and comes off
                    again the moment they accept.
                  </>
                )}
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Your admin bypass ignores this — you never need the password to view the site.
              </p>
            </>
          )}
        </div>

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
          A build runs unattended to <em>ready for review</em>. Nothing is sent to the business
          until you approve it, and the SMS then goes out on the next cron run.
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
