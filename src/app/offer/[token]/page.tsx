import { notFound } from 'next/navigation'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { publicAppOrigin } from '@/lib/urls'
import { priceSpecOffer, purgeGraceHours, specPreviewUrl } from '@/lib/spec/specOffer'
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

  // Lazy expiry on read. The cron does this too, but a page that tells someone
  // their offer is live when the deadline passed an hour ago is worse than one
  // that is a minute early — and this way the page is right even if the cron is
  // down.
  let status = build.status
  if (
    build.offer_deadline_at &&
    new Date(build.offer_deadline_at).getTime() < Date.now() &&
    ['offer_sent', 'offer_reminded', 'approved'].includes(status)
  ) {
    await supabase
      .from('spec_builds')
      .update({
        status: 'expired',
        purge_after: new Date(Date.now() + purgeGraceHours() * 3600_000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', build.id)
      .in('status', ['offer_sent', 'offer_reminded', 'approved'])
    status = 'expired'
  }

  const pricing = priceSpecOffer(build.offer_discount_bps)
  const pricingUrl = `${publicAppOrigin().replace(/\/$/, '')}/#pricing`

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

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-widest text-indigo-600">
        A website for {build.business_name}
      </p>

      {closed ? (
        <>
          <h1 className="mt-3 text-3xl font-semibold text-gray-900">This one has expired</h1>
          <p className="mt-4 text-gray-600">
            We built {build.business_name} a website and held it for a week. Nobody got back to
            us, so it has been taken down — as promised.
          </p>
          <p className="mt-4 text-gray-600">
            If you saw this late and still want it, reply to the text and we will rebuild it.
          </p>
        </>
      ) : accepted ? (
        <>
          <h1 className="mt-3 text-3xl font-semibold text-gray-900">You&apos;re all set</h1>
          <p className="mt-4 text-gray-600">
            Thanks — we have your details and will be in touch shortly to talk through changes
            and the domain name you want it on.
          </p>
        </>
      ) : (
        <>
          <h1 className="mt-3 text-3xl font-semibold text-gray-900">
            We already built it. Have a look.
          </h1>
          <p className="mt-4 text-gray-600">
            No catch and nothing to fill in — the site below already exists, built from your
            Google listing and what you told us. Everything on it can be changed.
          </p>

          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-block rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-800"
            >
              See your website →
            </a>
          )}

          <div className="mt-10 rounded-xl border border-indigo-200 bg-indigo-50 p-6">
            <p className="text-sm font-medium uppercase tracking-wide text-indigo-700">
              If you want to keep it
            </p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {pricing.offerLabel}{' '}
              <span className="text-lg font-normal text-gray-500 line-through">
                {pricing.listLabel}
              </span>
            </p>
            <p className="mt-2 text-sm text-gray-700">
              That is {pricing.percentOff}% off our AI Premium build —{' '}
              <a href={pricingUrl} className="underline" target="_blank" rel="noreferrer">
                the same one on our pricing page
              </a>
              . It covers customising the site with you and putting it on a domain name of your
              choosing; we can help you get one.
            </p>
            {build.offer_deadline_at && (
              <p className="mt-3 text-sm font-medium text-indigo-800">
                Open until {deadlineLabel(build.offer_deadline_at)} — after that the site comes
                down.
              </p>
            )}
          </div>

          <OfferActions token={token} businessName={build.business_name} />
        </>
      )}

      <p className="mt-12 border-t border-gray-200 pt-6 text-xs text-gray-500">
        We built this speculatively after finding {build.business_name} online. It is not public
        and search engines are told to ignore it. Not interested? Say so above, or reply STOP to
        the text and we will not contact you again.
      </p>
    </main>
  )
}
