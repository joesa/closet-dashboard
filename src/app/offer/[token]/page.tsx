import { notFound } from 'next/navigation'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { publicAppOrigin } from '@/lib/urls'
import { expireOfferIfLapsed, priceSpecOffer, specPreviewUrl } from '@/lib/spec/specOffer'
import { derivePreviewPassword } from '@/lib/spec/specPreviewPassword'
import { SPEC_BUILD_SELECT, type SpecBuildRow } from '@/lib/spec/types'
import OfferActions from './OfferActions'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// A page about one business, reachable only with an unguessable token. It must
// never be indexed, and never used to train a picture of that company.
export const metadata = {
  robots: { index: false, follow: false },
}

function deadlineLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Chicago',
  })
}

function StatusPill({ children, tone = 'indigo' }: { children: React.ReactNode; tone?: 'indigo' | 'emerald' | 'slate' }) {
  const styles =
    tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'slate'
        ? 'border-slate-200 bg-slate-100 text-slate-700'
        : 'border-indigo-200 bg-indigo-50 text-indigo-700'
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${styles}`}>
      {children}
    </span>
  )
}

function StatCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/80 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      {note && <div className="mt-1 text-sm text-slate-500">{note}</div>}
    </div>
  )
}

export default async function OfferPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = getSupabaseAdmin()

  const { data } = await supabase
    .from('spec_builds')
    .select(SPEC_BUILD_SELECT)
    .eq('offer_token', token)
    .maybeSingle()

  if (!data) notFound()
  const build = data as SpecBuildRow

  // Lazy expiry on read, so the page is right even if the cron is delayed —
  // it only runs once a day. The transition itself lives in specOffer.
  const status = await expireOfferIfLapsed(build)

  const pricing = priceSpecOffer(build.offer_discount_bps)
  const pricingUrl = `${publicAppOrigin().replace(/\/$/, '')}/#pricing`
  const previewPassword = derivePreviewPassword(build.id)

  let previewUrl: string | null = null
  if (build.tenant_id && !['expired', 'purged', 'declined'].includes(status)) {
    const { data: domain } = await supabase
      .from('domains')
      .select('hostname')
      .eq('tenant_id', build.tenant_id)
      .order('is_primary', { ascending: false })
      .limit(1)
      .maybeSingle()
    const hostname = (domain as { hostname?: string } | null)?.hostname
    if (hostname) previewUrl = specPreviewUrl(hostname, build.tenant_id)
  }

  const closed = ['expired', 'purged', 'declined'].includes(status)
  const accepted = status === 'accepted'

  const highlights = [
    'Private link',
    'Password protected',
    'Copy, layout, and domain can all be changed',
  ]

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.28),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.18),_transparent_24%),linear-gradient(180deg,_#07111f_0%,_#0b1324_46%,_#0f172a_100%)]" />
      <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.22)_1px,transparent_1px)] [background-size:36px_36px]" />

      <div className="relative mx-auto max-w-6xl px-6 py-10 lg:py-14">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <StatusPill tone="indigo">One-off proposal</StatusPill>
          <p className="text-xs text-slate-400">
            Built for {build.business_name} · not indexed · deadline is enforced
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          <section className="space-y-6 rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-8 lg:p-10">
            <div className="max-w-2xl space-y-5">
              {closed ? (
                <StatusPill tone="slate">Offer closed</StatusPill>
              ) : accepted ? (
                <StatusPill tone="emerald">Accepted</StatusPill>
              ) : (
                <StatusPill>Ready for review</StatusPill>
              )}

              {closed ? (
                <>
                  <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                    This preview has expired.
                  </h1>
                  <p className="max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
                    We built {build.business_name} a website and held it for a week. Nobody got
                    back to us, so it has been taken down as promised.
                  </p>
                  <p className="max-w-xl text-sm leading-6 text-slate-400">
                    If you saw this late and still want it, reply to the text and we can rebuild
                    it.
                  </p>
                </>
              ) : accepted ? (
                <>
                  <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                    You&apos;re all set.
                  </h1>
                  <p className="max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
                    Thanks. We have your details and will follow up about changes and the domain
                    name you want it on.
                  </p>
                </>
              ) : (
                <>
                  <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                    We already built {build.business_name} a website.
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                    No catch and nothing to fill in. The site below already exists, built from the
                    Google listing and what was found online. The copy, layout, and domain can all
                    be changed.
                  </p>

                  <div className="flex flex-wrap gap-3">
                    {previewUrl && (
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-indigo-950/30 transition hover:-translate-y-0.5 hover:bg-slate-100"
                      >
                        Open private link →
                      </a>
                    )}
                    {build.offer_deadline_at && (
                      <div className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-4 py-3 text-sm text-slate-200">
                        Held until {deadlineLabel(build.offer_deadline_at)}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    {highlights.map((item) => (
                      <div
                        key={item}
                        className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-200"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {!closed && !accepted && (
              <div className="rounded-[1.75rem] border border-white/10 bg-slate-900/70 p-5 shadow-inner shadow-black/20">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-300">
                      If you want to keep it
                    </p>
                    <p className="mt-2 text-4xl font-semibold tracking-tight text-white">
                      {pricing.offerLabel}{' '}
                      <span className="ml-2 text-base font-normal text-slate-400 line-through">
                        {pricing.listLabel}
                      </span>
                    </p>
                  </div>
                </div>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                  That is {pricing.percentOff}% off the full custom build —{' '}
                  <a href={pricingUrl} className="font-medium text-white underline decoration-indigo-300/70 underline-offset-4" target="_blank" rel="noreferrer">
                    the same one on our pricing page
                  </a>
                  . It includes the site, customization with you, and help getting a domain name.
                </p>
              </div>
            )}

            {closed && (
              <div className="rounded-[1.75rem] border border-white/10 bg-slate-900/70 p-5 text-slate-300">
                This build was speculative after finding {build.business_name} online. Search engines
                are told not to index it.
              </div>
            )}
          </section>

          <aside className="space-y-4 lg:sticky lg:top-8">
            {!closed && !accepted && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                <StatCard label="Offer" value={pricing.offerLabel} note={`${pricing.percentOff}% off full custom build`} />
                <StatCard label="Deadline" value={build.offer_deadline_at ? deadlineLabel(build.offer_deadline_at) : '—'} note="After this, the site comes down." />
                <StatCard label="Access code" value={previewPassword ?? '—'} note="Private link only." />
              </div>
            )}

            <div className="rounded-[1.75rem] border border-white/10 bg-white/90 p-6 text-slate-900 shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
              <OfferActions token={token} businessName={build.business_name} />
            </div>
          </aside>
        </div>

        <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-6 text-slate-400">
          We built this speculatively after finding {build.business_name} online. It is not public
          and search engines are told to ignore it. Not interested? Say so above, or reply STOP to
          the text and we will not contact you again.
        </p>
      </div>
    </main>
  )
}
