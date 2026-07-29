'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import Script from 'next/script'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { getBrowserSession, signOutBrowser } from '@/lib/supabase-browser'
import { DEMO_CONTRACTOR_ID, DEMO_LOGIN, DEMO_RESET_NOTICE } from '@/lib/demo'
import {
  getTierCatalog,
  getSiteMaintenancePricing,
  getWidgetSubscriptionPricing,
  maintenanceDisplay,
  subscriptionBillingDisplay,
  formatUsd,
} from '@/lib/intake/tiers'
import { PUBLIC_API_URL, WIDGET_CDN_URL } from '@/lib/urls'

/* ─────────────────────────────────────────────────────────────────────
   Landing palette — light, product-first. One accent (ultramarine),
   ink buttons, hairline borders, layered shadows via .landing-shadow-*.
   The rest of the app is dark; this page carries its own light theme.
   ──────────────────────────────────────────────────────────────────── */
const INK = '#10141A'
const INK_2 = '#4E5761'
const INK_3 = '#8B939C'
const BG = '#FBFBFA'
const SURFACE_2 = '#F4F5F4'
const HAIRLINE = '#E7E8E8'
const HAIRLINE_2 = '#D8DADB'
const ACCENT = '#2438C9'
const ACCENT_SOFT = '#EDEFFB'

/**
 * "Start Free" / "Start Your 30-Day Free Trial" is ambiguous on its own — the
 * free trial is specifically for the embeddable widget, but a visitor with no
 * website yet needs a full site build (with the calculator embedded in it),
 * not a bare account. This modal makes that fork explicit before routing
 * anywhere, instead of silently dropping "no website" visitors into a
 * widget-only signup they can't actually use yet.
 */
function StartChoiceModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="start-choice-heading"
    >
      <div
        className="landing-shadow-panel relative w-full max-w-lg rounded-2xl border bg-white p-8"
        style={{ borderColor: HAIRLINE }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-5 top-5 transition hover:opacity-70"
          style={{ color: INK_3 }}
        >
          ✕
        </button>

        <h3
          id="start-choice-heading"
          className="text-xl font-semibold tracking-tight"
          style={{ color: INK }}
        >
          Which one are you?
        </h3>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: INK_2 }}>
          The 30-day free trial is for the embeddable quote calculator widget.
          If you don&apos;t have a site to embed it on yet, we build one for
          you — with the calculator already wired in.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => router.push('/signup/pro')}
            className="flex flex-col items-start gap-2 rounded-xl border p-5 text-left transition hover:border-[#8B939C]"
            style={{ borderColor: HAIRLINE_2 }}
          >
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{ background: SURFACE_2, color: INK_2 }}
            >
              30-day free trial
            </span>
            <span className="mt-2 text-sm font-semibold" style={{ color: INK }}>
              I already have a website
            </span>
            <span className="text-xs leading-relaxed" style={{ color: INK_2 }}>
              Just embed the instant quote calculator on your existing site.
              No card required to start.
            </span>
          </button>

          <button
            type="button"
            onClick={() => router.push('/get-started?tier=ai_premium')}
            className="flex flex-col items-start gap-2 rounded-xl border-2 p-5 text-left transition hover:opacity-90"
            style={{ borderColor: ACCENT, background: ACCENT_SOFT }}
          >
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-medium text-white"
              style={{ background: ACCENT }}
            >
              From {formatUsd(getTierCatalog().find((t) => t.slug === 'standard')!.totalCents)}
            </span>
            <span className="mt-2 text-sm font-semibold" style={{ color: INK }}>
              I don&apos;t have a website yet
            </span>
            <span className="text-xs leading-relaxed" style={{ color: INK_2 }}>
              We&apos;ll design and build you a full marketing site — your
              quote calculator comes built in. Compare plans below.
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const router = useRouter()
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [showStartModal, setShowStartModal] = useState(false)

  useEffect(() => {
    // Local cookie read only — never getUser() on the marketing page (can hang
    // the auth lock and freeze the tab on refresh with a stale refresh token).
    void getBrowserSession().then((session) => {
      if (session) setIsLoggedIn(true)
    })
  }, [])

  // Deep-link from demo sticky CTAs / widget success: /?start=free opens the
  // same "Which one are you?" chooser as the nav Start Free button.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const hash = window.location.hash.replace(/^#/, '')
    if (params.get('start') === 'free' || hash === 'start') {
      setShowStartModal(true)
    }
  }, [])

  const handleSignOut = async () => {
    if (signingOut) return
    setSigningOut(true)
    // Flip UI immediately — never wait on a global Auth revoke that can hang.
    setIsLoggedIn(false)
    try {
      await signOutBrowser()
    } finally {
      setSigningOut(false)
      router.refresh()
    }
  }

  const demoLoginHref = `/login?email=${encodeURIComponent(DEMO_LOGIN.email)}&password=${encodeURIComponent(DEMO_LOGIN.password)}`

  return (
    <div
      className="min-h-screen antialiased"
      style={{ background: BG, color: INK }}
    >
      <Script src={WIDGET_CDN_URL} strategy="lazyOnload" />

      {/* ─── Nav ─── */}
      <nav
        className="sticky top-0 z-50 border-b backdrop-blur-xl"
        style={{ borderColor: HAIRLINE, background: 'rgba(251,251,250,0.85)' }}
      >
        <div className="mx-auto flex h-[60px] max-w-6xl items-center justify-between px-6">
          <span className="text-[16px] font-semibold tracking-tight">
            Ditch<span style={{ color: INK_3 }}>the</span>Form
          </span>
          <div className="flex items-center gap-6">
            <a
              href="#demo"
              className="hidden text-[13.5px] font-medium transition hover:opacity-70 sm:inline"
              style={{ color: INK_2 }}
            >
              Product
            </a>
            <a
              href="#pricing"
              className="hidden text-[13.5px] font-medium transition hover:opacity-70 sm:inline"
              style={{ color: INK_2 }}
            >
              Pricing
            </a>
            {isLoggedIn ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-[13.5px] font-medium transition hover:opacity-70"
                  style={{ color: INK_2 }}
                >
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  disabled={signingOut}
                  className="rounded-full border px-4 py-2 text-[13px] font-medium transition hover:opacity-70 disabled:opacity-50"
                  style={{ borderColor: HAIRLINE_2, color: INK }}
                >
                  {signingOut ? 'Signing out…' : 'Sign Out'}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-[13.5px] font-medium transition hover:opacity-70"
                  style={{ color: INK_2 }}
                >
                  Sign in
                </Link>
                <button
                  type="button"
                  onClick={() => setShowStartModal(true)}
                  className="rounded-full px-4 py-2 text-[13px] font-medium text-white transition hover:opacity-85 active:scale-[0.98]"
                  style={{ background: INK }}
                >
                  Start free
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      <StartChoiceModal
        open={showStartModal}
        onClose={() => setShowStartModal(false)}
      />

      {/* ─── Hero ─── */}
      <section className="mx-auto max-w-3xl px-6 pb-14 pt-24 text-center">
        <span
          className="landing-rise inline-flex items-center rounded-full px-4 py-1.5 text-[12.5px] font-medium"
          style={{ background: ACCENT_SOFT, color: ACCENT }}
        >
          Instant quotes for service businesses
        </span>
        <h1
          className="landing-rise mx-auto mt-7 max-w-[15ch] text-[44px] font-medium leading-[1.03] tracking-[-0.035em] sm:text-6xl md:text-7xl"
          style={{ '--rise-d': 60 } as React.CSSProperties}
        >
          The quote happens on your site.{' '}
          <span style={{ color: INK_3 }}>The lead lands on your phone.</span>
        </h1>
        <p
          className="landing-rise mx-auto mt-6 max-w-[46ch] text-lg leading-relaxed"
          style={{ color: INK_2, '--rise-d': 120 } as React.CSSProperties}
        >
          DitchTheForm replaces your contact form with an instant-quote
          calculator. Visitors price their own job in about thirty seconds,
          and the lead arrives by text before they&apos;ve called anyone else.
        </p>
        <div
          className="landing-rise mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
          style={{ '--rise-d': 180 } as React.CSSProperties}
        >
          <button
            type="button"
            onClick={() => setShowStartModal(true)}
            className="rounded-full px-6 py-3.5 text-sm font-medium text-white transition hover:opacity-85 active:scale-[0.98]"
            style={{ background: INK }}
          >
            Start free for 30 days
          </button>
          <a
            href="#demo"
            className="rounded-full border px-6 py-3.5 text-sm font-medium transition hover:border-[#8B939C]"
            style={{ borderColor: HAIRLINE_2, color: INK }}
          >
            See it price a job
          </a>
        </div>
        <p
          className="landing-rise mt-5 text-[12.5px]"
          style={{ color: INK_3, '--rise-d': 240 } as React.CSSProperties}
        >
          No card required · No per-lead fees ·{' '}
          <a
            href={demoLoginHref}
            className="underline underline-offset-4 transition hover:opacity-70"
            style={{ color: INK_2 }}
          >
            Try the live demo
          </a>
        </p>
      </section>

      {/* ─── Product collage: the live widget with floating lead layers ─── */}
      <section id="demo" className="relative mx-auto max-w-[980px] px-6 pb-20">
        <div
          className="landing-rise landing-shadow-panel overflow-hidden rounded-2xl border bg-white"
          style={{
            borderColor: HAIRLINE,
            '--rise-d': 200,
            // Promote to its own compositing layer so scroll over the
            // sticky blurred nav doesn't keep repainting the widget
            // (Chromium backdrop-filter + overflow:hidden flicker bug).
            transform: 'translateZ(0)',
            willChange: 'transform',
            contain: 'paint',
          } as React.CSSProperties}
        >
          <div
            className="flex h-11 items-center justify-center border-b"
            style={{ borderColor: HAIRLINE }}
          >
            <span
              className="rounded-md px-10 py-1 font-mono text-[11px]"
              style={{ background: SURFACE_2, color: INK_3 }}
            >
              yourwebsite.com
            </span>
          </div>
          {/* min-height keeps the panel (and the floating cards anchored to
              it) stable while the widget script loads */}
          <div className="min-h-[440px] bg-white">
            <closet-quote-widget
              data-contractor-id={DEMO_CONTRACTOR_ID}
              data-api-url={PUBLIC_API_URL}
            />
          </div>
        </div>

        {/* Floating install chip — decorative, never intercepts clicks */}
        <div
          className="landing-rise landing-shadow-float pointer-events-none absolute left-0 top-24 hidden -translate-x-5 rounded-xl border bg-white px-4 py-3 font-mono text-xs xl:block"
          style={{ borderColor: HAIRLINE, color: INK_2, '--rise-d': 550 } as React.CSSProperties}
          aria-hidden="true"
        >
          <span className="font-bold" style={{ color: ACCENT }}>
            ✓
          </span>{' '}
          widget installed · 1 line of code
        </div>

        {/* The lead arriving as a text — floats beside the panel on wide
            screens, sits below it otherwise */}
        <div
          className="landing-rise landing-shadow-float mt-4 rounded-2xl border bg-white p-4 xl:pointer-events-none xl:absolute xl:-right-9 xl:bottom-10 xl:mt-0 xl:w-[330px]"
          style={{ borderColor: HAIRLINE, '--rise-d': 400 } as React.CSSProperties}
          role="img"
          aria-label="Example of a lead arriving as a text message"
        >
          <div
            className="mb-2.5 flex items-baseline justify-between text-[11.5px]"
            style={{ color: INK_3 }}
          >
            <span className="font-medium" style={{ color: INK_2 }}>
              New lead · SMS
            </span>
            <span>now</span>
          </div>
          <div
            className="rounded-2xl rounded-bl-[4px] px-3.5 py-3 text-[13.5px] leading-relaxed"
            style={{ background: '#E9E9EB', color: '#1B1D21' }}
          >
            <span className="font-semibold">Dana R. · (555) 201-4488</span>
            <br />
            Walk-in closet, 96 sq ft · Standard tier
            <br />
            Soft-close + LED lighting ·{' '}
            <span className="font-semibold">$7,620</span>
          </div>
          <p className="mt-2 text-[11px]" style={{ color: INK_3 }}>
            Delivered 8 seconds after the quote was locked in
          </p>
        </div>

        {/* Daily reset notice — tells prospects the demo is shared state and
            will revert nightly so they don't feel hesitant to click around.
            Matches the banner shown in the demo account's admin dashboard. */}
        <div
          className="mt-5 flex flex-col gap-3 rounded-2xl border px-5 py-4 text-[13px]"
          style={{ borderColor: HAIRLINE, color: INK_2 }}
        >
          <p className="leading-relaxed">
            <span className="font-semibold" style={{ color: INK }}>
              {DEMO_RESET_NOTICE.short}
            </span>{' '}
            This is the real widget wired to a shared demo business — pick a
            service, size the job, and submit dummy info to see exactly how
            the lead is captured. Everything resets to the default demo
            configuration nightly.
          </p>
          <div
            className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3"
            style={{ borderColor: HAIRLINE, color: INK_3 }}
          >
            <span className="font-semibold" style={{ color: INK_2 }}>
              Demo login:
            </span>
            <span>
              email{' '}
              <span className="font-mono" style={{ color: INK }}>
                {DEMO_LOGIN.email}
              </span>
            </span>
            <span>
              password{' '}
              <span className="font-mono" style={{ color: INK }}>
                {DEMO_LOGIN.password}
              </span>
            </span>
          </div>
        </div>
      </section>

      {/* ─── Proof strip ─── */}
      <section className="border-y" style={{ borderColor: HAIRLINE }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-baseline justify-center gap-x-14 gap-y-3 px-6 py-6">
          <span className="text-xs" style={{ color: INK_3 }}>
            Running on
          </span>
          <span
            className="font-serif text-[15px] italic"
            style={{ color: INK_3 }}
          >
            Lumina
          </span>
          <span
            className="text-[13px] font-bold uppercase tracking-[0.14em]"
            style={{ color: INK_3 }}
          >
            Ironclad
          </span>
          <span
            className="font-serif text-[15px] italic"
            style={{ color: INK_3 }}
          >
            Hearth &amp; Home
          </span>
          <span className="text-xs" style={{ color: INK_3 }}>
            and service businesses across six trades
          </span>
        </div>
      </section>

      {/* ─── How it works — each card holds a product fragment ─── */}
      <section className="mx-auto max-w-6xl px-6 pt-24">
        <p className="mb-3 text-[13px] font-semibold" style={{ color: ACCENT }}>
          How it works
        </p>
        <h2 className="max-w-[24ch] text-3xl font-medium tracking-[-0.03em] sm:text-[40px] sm:leading-[1.1]">
          Your prices. One line of code. Leads by text.
        </h2>
        <p
          className="mt-4 max-w-[56ch] text-[16px] leading-relaxed"
          style={{ color: INK_2 }}
        >
          Everything the calculator quotes comes off a rate sheet you control —
          change a number in the dashboard and the widget quotes the new price
          immediately. Nothing is averaged or marked up.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          {/* Set your rates */}
          <div
            className="landing-shadow-card flex flex-col overflow-hidden rounded-2xl border bg-white"
            style={{ borderColor: HAIRLINE }}
          >
            <div className="p-6 pb-5">
              <h3 className="text-[17px] font-semibold tracking-tight">
                Set your rates
              </h3>
              <p
                className="mt-1.5 text-sm leading-relaxed"
                style={{ color: INK_2 }}
              >
                Per square foot, flat tiers, or base plus distance — with the
                add-ons you actually sell. Switch off anything you don&apos;t
                carry.
              </p>
            </div>
            <div
              className="mt-auto border-t p-6 pt-5"
              style={{ borderColor: HAIRLINE, background: SURFACE_2 }}
              aria-hidden="true"
            >
              {[
                { tier: 'Basic', rate: '$45 / sq ft', hot: false },
                { tier: 'Standard', rate: '$75 / sq ft', hot: true },
                { tier: 'Premium', rate: '$140 / sq ft', hot: false },
              ].map(({ tier, rate, hot }) => (
                <div
                  key={tier}
                  className="mb-2 flex items-baseline justify-between rounded-lg border bg-white px-3.5 py-2.5 text-[13px] last:mb-0"
                  style={{ borderColor: hot ? ACCENT : HAIRLINE }}
                >
                  <span className="font-medium">{tier}</span>
                  <span
                    className="font-mono text-xs tabular-nums"
                    style={{ color: hot ? ACCENT : INK_2, fontWeight: hot ? 600 : 400 }}
                  >
                    {rate}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Embed it anywhere */}
          <div
            className="landing-shadow-card flex flex-col overflow-hidden rounded-2xl border bg-white"
            style={{ borderColor: HAIRLINE }}
          >
            <div className="p-6 pb-5">
              <h3 className="text-[17px] font-semibold tracking-tight">
                Embed it anywhere
              </h3>
              <p
                className="mt-1.5 text-sm leading-relaxed"
                style={{ color: INK_2 }}
              >
                WordPress, Squarespace, Webflow, or plain HTML. The average
                install takes about a minute, and it inherits your page.
              </p>
            </div>
            <div
              className="mt-auto border-t p-6 pt-5"
              style={{ borderColor: HAIRLINE, background: SURFACE_2 }}
              aria-hidden="true"
            >
              <pre
                className="overflow-x-auto rounded-lg border bg-white px-4 py-3.5 font-mono text-[12.5px] leading-relaxed"
                style={{ borderColor: HAIRLINE, color: INK_2 }}
              >
                <code>
                  &lt;<span style={{ color: ACCENT }}>closet-quote-widget</span>
                  {'\n'}
                  {'  '}
                  <span style={{ color: INK }}>data-contractor-id</span>
                  =&quot;…&quot;
                  {'\n'}/&gt;
                </code>
              </pre>
            </div>
          </div>

          {/* Get the lead instantly */}
          <div
            className="landing-shadow-card flex flex-col overflow-hidden rounded-2xl border bg-white"
            style={{ borderColor: HAIRLINE }}
          >
            <div className="p-6 pb-5">
              <h3 className="text-[17px] font-semibold tracking-tight">
                Get the lead instantly
              </h3>
              <p
                className="mt-1.5 text-sm leading-relaxed"
                style={{ color: INK_2 }}
              >
                Name, number, service, job size, and chosen options arrive by
                text through Twilio, with an email copy for your records.
              </p>
            </div>
            <div
              className="mt-auto border-t p-6 pt-5"
              style={{ borderColor: HAIRLINE, background: SURFACE_2 }}
              aria-hidden="true"
            >
              <div
                className="rounded-2xl rounded-bl-[4px] px-3.5 py-2.5 text-[12.5px]"
                style={{ background: '#E9E9EB', color: '#1B1D21' }}
              >
                <span className="font-semibold">Dana R.</span> · Walk-in, 96 sq
                ft · $7,620
              </div>
              <p className="mt-2 text-[10.5px]" style={{ color: INK_3 }}>
                SMS · delivered in 8s · email copy sent
              </p>
            </div>
          </div>
        </div>

        {/* Numbers band */}
        <div
          className="mt-14 grid grid-cols-1 gap-8 border-t pt-10 sm:grid-cols-3"
          style={{ borderColor: HAIRLINE }}
        >
          {[
            { value: '60s', label: 'Average install, paste to live' },
            { value: '$0', label: 'For the first 30 days, no card' },
            { value: '0', label: 'Per-lead fees, on any plan' },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-5xl font-medium tracking-[-0.035em] tabular-nums sm:text-6xl">
                {stat.value}
              </div>
              <div className="mt-2 text-[13.5px]" style={{ color: INK_3 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <PricingSection />

      {/* ─── Final CTA ─── */}
      <section className="mx-auto max-w-3xl px-6 py-28 text-center">
        <h2 className="mx-auto max-w-[18ch] text-3xl font-medium tracking-[-0.03em] sm:text-[40px] sm:leading-[1.1]">
          Put your prices in. Watch it quote a job.
        </h2>
        <p
          className="mx-auto mt-5 max-w-[46ch] text-[16px] leading-relaxed"
          style={{ color: INK_2 }}
        >
          The first month is free and there&apos;s no card to enter. If it
          doesn&apos;t bring you leads, cancel and you&apos;ve spent nothing.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => setShowStartModal(true)}
            className="rounded-full px-6 py-3.5 text-sm font-medium text-white transition hover:opacity-85 active:scale-[0.98]"
            style={{ background: INK }}
          >
            Start free for 30 days
          </button>
          <a
            href="#demo"
            className="rounded-full border px-6 py-3.5 text-sm font-medium transition hover:border-[#8B939C]"
            style={{ borderColor: HAIRLINE_2, color: INK }}
          >
            Try the demo first
          </a>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t" style={{ borderColor: HAIRLINE }}>
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            <div className="col-span-2 sm:col-span-1">
              <span className="text-sm font-semibold tracking-tight">
                Ditch<span style={{ color: INK_3 }}>the</span>Form
              </span>
              <p
                className="mt-3 max-w-[200px] text-xs leading-relaxed"
                style={{ color: INK_3 }}
              >
                Instant quote calculators for service businesses. More leads,
                less friction.
              </p>
            </div>

            <div>
              <h4
                className="mb-4 text-xs font-semibold"
                style={{ color: INK_2 }}
              >
                Product
              </h4>
              <ul className="space-y-2.5">
                <li>
                  <a
                    href="#demo"
                    className="text-xs transition hover:opacity-70"
                    style={{ color: INK_3 }}
                  >
                    Live Demo
                  </a>
                </li>
                <li>
                  <a
                    href="#pricing"
                    className="text-xs transition hover:opacity-70"
                    style={{ color: INK_3 }}
                  >
                    Pricing
                  </a>
                </li>
                <li>
                  <a
                    href="#portfolio"
                    className="text-xs transition hover:opacity-70"
                    style={{ color: INK_3 }}
                  >
                    Portfolio
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4
                className="mb-4 text-xs font-semibold"
                style={{ color: INK_2 }}
              >
                Company
              </h4>
              <ul className="space-y-2.5">
                <li>
                  <a
                    href="mailto:support@ditchtheform.com"
                    className="text-xs transition hover:opacity-70"
                    style={{ color: INK_3 }}
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4
                className="mb-4 text-xs font-semibold"
                style={{ color: INK_2 }}
              >
                Account
              </h4>
              <ul className="space-y-2.5">
                {isLoggedIn ? (
                  <>
                    <li>
                      <Link
                        href="/dashboard"
                        className="text-xs transition hover:opacity-70"
                        style={{ color: INK_3 }}
                      >
                        Dashboard
                      </Link>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => void handleSignOut()}
                        disabled={signingOut}
                        className="text-xs transition hover:opacity-70 disabled:opacity-50"
                        style={{ color: INK_3 }}
                      >
                        {signingOut ? 'Signing out…' : 'Sign Out'}
                      </button>
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <Link
                        href="/login"
                        className="text-xs transition hover:opacity-70"
                        style={{ color: INK_3 }}
                      >
                        Sign In
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/signup"
                        className="text-xs transition hover:opacity-70"
                        style={{ color: INK_3 }}
                      >
                        Sign Up
                      </Link>
                    </li>
                  </>
                )}
              </ul>
            </div>
          </div>

          <div
            className="mt-12 border-t pt-6"
            style={{ borderColor: HAIRLINE }}
          >
            <span className="text-[11px]" style={{ color: INK_3 }}>
              © {new Date().getFullYear()} DitchTheForm. All rights reserved.
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ─── Pricing section ─────────────────────────────────────────────── */

const WIDGET_FEATURES = [
  'Interactive instant-quote widget for your existing site',
  'One-line embed — WordPress, Squarespace, Webflow, or custom HTML',
  'Unlimited SMS & email lead capture (no per-lead fees)',
  'Custom services, job types & pricing rules (per-unit, tiered, or distance)',
  'Dynamic add-on manager for upsells & extras',
  'Lead inbox, quote history & business dashboard',
  'Works alongside your current brand and domain',
]

const STANDARD_FEATURES = [
  'Custom marketing site + embedded quote calculator',
  'Up to 5 pages — Home plus 4 you choose during setup',
  'Professional stock hero & service imagery',
  'Unlimited lead capture via SMS & email',
  'Custom service & option pricing',
  'After launch: hosting, SSL, Pro widget, and 1 content tweak/month',
]

const PREMIUM_FEATURES = [
  'Everything in Standard',
  'Up to 10 pages — Home plus 9 you choose during setup',
  'AI-written selling copy for every page — no blank or placeholder content',
  'Custom AI hero & service photos (you pick during setup)',
  'Photoreal, art-directed imagery — no generic AI-looking renders',
  'Firecrawl-informed market pricing for your metro',
  '2 revision rounds in the first 30 days after launch',
  'Up to 3 generations per image (3 options each)',
]

function HowSiteBuildPaymentWorks() {
  const standard = getTierCatalog().find((t) => t.slug === 'standard')!
  const premium = getTierCatalog().find((t) => t.slug === 'ai_premium')!
  const maintenance = getSiteMaintenancePricing()

  return (
    <div className="mt-24">
      <p className="mb-3 text-[13px] font-semibold" style={{ color: ACCENT }}>
        Payment terms
      </p>
      <h3 className="max-w-[26ch] text-2xl font-medium tracking-[-0.025em] sm:text-[32px] sm:leading-[1.15]">
        You approve the site before you pay for it
      </h3>
      <p
        className="mt-4 max-w-[60ch] text-[15px] leading-relaxed"
        style={{ color: INK_2 }}
      >
        Start at{' '}
        <Link
          href="/get-started"
          className="underline underline-offset-4"
          style={{ color: ACCENT }}
        >
          /get-started
        </Link>
        . Intake shows the same options. After launch, site maintenance is{' '}
        {formatUsd(maintenance.monthlyCents)}/mo or{' '}
        {formatUsd(maintenance.yearlyCents)}/yr (save{' '}
        {formatUsd(maintenance.yearlySavingsCents)}).
      </p>

      <div className="mt-9 border-t" style={{ borderColor: HAIRLINE }}>
        <div
          className="grid grid-cols-1 gap-3 border-b py-7 md:grid-cols-[220px_1fr_260px] md:gap-8"
          style={{ borderColor: HAIRLINE }}
        >
          <h4 className="text-[15.5px] font-semibold tracking-tight">
            Standard build
          </h4>
          <p className="text-sm leading-relaxed" style={{ color: INK_2 }}>
            We build your site with stock imagery and send you the working
            preview. If you want it, you pay the full{' '}
            {formatUsd(standard.totalCents)}{' '}and we launch it — full access to
            your dashboard, leads, and settings handed over. If you
            don&apos;t, you owe nothing.
          </p>
          <p
            className="text-[13px] tabular-nums md:text-right"
            style={{ color: INK_2 }}
          >
            Due today{' '}
            <span className="font-semibold" style={{ color: ACCENT }}>
              $0
            </span>{' '}
            · On approval {formatUsd(standard.totalCents)}
          </p>
        </div>
        <div
          className="grid grid-cols-1 gap-3 border-b py-7 md:grid-cols-[220px_1fr_260px] md:gap-8"
          style={{ borderColor: HAIRLINE }}
        >
          <h4 className="text-[15.5px] font-semibold tracking-tight">
            AI Premium build
          </h4>
          <p className="text-sm leading-relaxed" style={{ color: INK_2 }}>
            The {formatUsd(premium.depositCents)} deposit (30%) unlocks the AI
            image studio on intake — we build with the shots you choose. You
            review the finished site, and the {formatUsd(premium.remainderCents)}{' '}
            balance is due only if you approve it before launch. Not
            satisfied? The deposit is returned.
          </p>
          <p
            className="text-[13px] tabular-nums md:text-right"
            style={{ color: INK_2 }}
          >
            Due today{' '}
            <span className="font-semibold" style={{ color: ACCENT }}>
              {formatUsd(premium.depositCents)}
            </span>{' '}
            · On approval {formatUsd(premium.remainderCents)}
          </p>
        </div>
      </div>
    </div>
  )
}

function PlanBillingToggle({
  billing,
  onBillingChange,
  savingsCents,
  monthlyLabel,
  yearlyLabel,
}: {
  billing: 'monthly' | 'yearly'
  onBillingChange: (b: 'monthly' | 'yearly') => void
  savingsCents: number
  monthlyLabel: string
  yearlyLabel: string
}) {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border p-1"
      style={{ borderColor: HAIRLINE_2 }}
    >
      <button
        type="button"
        onClick={() => onBillingChange('monthly')}
        className="rounded-full px-3.5 py-1.5 text-xs font-medium transition"
        style={
          billing === 'monthly'
            ? { background: INK, color: '#fff' }
            : { color: INK_2 }
        }
      >
        {monthlyLabel}
      </button>
      <button
        type="button"
        onClick={() => onBillingChange('yearly')}
        className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition"
        style={
          billing === 'yearly'
            ? { background: INK, color: '#fff' }
            : { color: INK_2 }
        }
      >
        {yearlyLabel}
        {savingsCents > 0 && (
          <span
            className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
            style={
              billing === 'yearly'
                ? { background: 'rgba(255,255,255,0.2)', color: '#fff' }
                : { background: ACCENT_SOFT, color: ACCENT }
            }
          >
            −{formatUsd(savingsCents)}
          </span>
        )}
      </button>
    </div>
  )
}

function PricingFeatureList({
  features,
  inverted = false,
}: {
  features: string[]
  inverted?: boolean
}) {
  return (
    <ul
      className="mb-7 space-y-2.5 border-t pt-5"
      style={{
        borderColor: inverted ? 'rgba(255,255,255,0.15)' : HAIRLINE,
      }}
    >
      {features.map((feature) => (
        <li
          key={feature}
          className="flex items-start gap-2.5 text-sm leading-relaxed"
          style={{ color: inverted ? 'rgba(251,251,250,0.75)' : INK_2 }}
        >
          <Check
            className="mt-1 h-3.5 w-3.5 flex-shrink-0"
            strokeWidth={3}
            style={{ color: inverted ? '#7C8CF8' : ACCENT }}
          />
          {feature}
        </li>
      ))}
    </ul>
  )
}

function PricingSection() {
  const catalog = getTierCatalog()
  const standard = catalog.find((t) => t.slug === 'standard')!
  const premium = catalog.find((t) => t.slug === 'ai_premium')!
  const maintenance = getSiteMaintenancePricing()
  const widgetSub = getWidgetSubscriptionPricing()

  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const siteMaint = maintenanceDisplay(billing, maintenance)
  const widgetDisplay = subscriptionBillingDisplay(billing, widgetSub)
  const maxYearlySavingsCents = Math.max(
    widgetSub.yearlySavingsCents,
    maintenance.yearlySavingsCents
  )

  return (
    <section id="pricing" className="mx-auto max-w-6xl px-6 pt-24">
      <p className="mb-3 text-[13px] font-semibold" style={{ color: ACCENT }}>
        Pricing
      </p>
      <h2 className="max-w-[24ch] text-3xl font-medium tracking-[-0.03em] sm:text-[40px] sm:leading-[1.1]">
        Bring a website, or have us build one
      </h2>
      <p
        className="mt-4 max-w-[56ch] text-[16px] leading-relaxed"
        style={{ color: INK_2 }}
      >
        The subscription covers the widget on your existing site. The builds
        are one-time fees for a complete marketing site with the calculator
        wired in; maintenance starts after launch.
      </p>

      <div className="mt-8 flex flex-col gap-2">
        <div>
          <PlanBillingToggle
            billing={billing}
            onBillingChange={setBilling}
            savingsCents={maxYearlySavingsCents}
            monthlyLabel="Monthly"
            yearlyLabel="Yearly"
          />
        </div>
        <p className="text-[11.5px]" style={{ color: INK_3 }}>
          Applies to the Pro subscription and site maintenance — build fees are
          one-time.
          {billing === 'yearly' && (
            <>
              {' '}
              Pro saves {formatUsd(widgetSub.yearlySavingsCents)}/yr ·
              maintenance saves {formatUsd(maintenance.yearlySavingsCents)}/yr
              vs monthly.
            </>
          )}
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Pro — widget on an existing site */}
        <div
          className="landing-shadow-card flex flex-col rounded-2xl border bg-white p-7"
          style={{ borderColor: HAIRLINE }}
        >
          <p className="mb-3 text-xs font-medium" style={{ color: INK_3 }}>
            For your existing site · 30-day free trial
          </p>
          <h3 className="text-lg font-semibold tracking-tight">Pro</h3>
          <p className="mb-5 text-[13.5px]" style={{ color: INK_2 }}>
            The widget, embedded on the site you have
          </p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[42px] font-medium tracking-[-0.03em] tabular-nums leading-none">
              {formatUsd(widgetDisplay.perMonthCents)}
            </span>
            <span className="text-sm" style={{ color: INK_3 }}>
              /mo
            </span>
          </div>
          <p className="mb-5 mt-2 text-[12.5px]" style={{ color: INK_3 }}>
            {widgetDisplay.billedLabel} · $0 for 30 days, no card required.
            After day 30, {formatUsd(widgetSub.monthlyCents)}/mo (or{' '}
            {formatUsd(widgetSub.yearlyCents)}/yr) unless you cancel.
          </p>
          <PricingFeatureList features={WIDGET_FEATURES} />
          <div className="mt-auto flex flex-col gap-2">
            <Link
              href="/signup/pro"
              className="flex w-full items-center justify-center rounded-full border px-5 py-3 text-sm font-medium transition hover:border-[#8B939C]"
              style={{ borderColor: HAIRLINE_2, color: INK }}
            >
              Start the free month
            </Link>
            <Link
              href={`/signup/pro?subscribe=1&plan=${billing}`}
              className="flex w-full items-center justify-center px-5 py-2 text-[13px] font-medium underline-offset-4 transition hover:underline"
              style={{ color: INK_2 }}
            >
              Subscribe now — skip trial
            </Link>
          </div>
        </div>

        {/* Standard site build */}
        <div
          className="landing-shadow-card flex flex-col rounded-2xl border bg-white p-7"
          style={{ borderColor: HAIRLINE }}
        >
          <p className="mb-3 text-xs font-medium" style={{ color: INK_3 }}>
            Site build · {standard.label}
          </p>
          <h3 className="text-lg font-semibold tracking-tight">
            Standard
          </h3>
          <p className="mb-5 text-[13.5px]" style={{ color: INK_2 }}>
            A five-page site with the calculator built in
          </p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[42px] font-medium tracking-[-0.03em] tabular-nums leading-none">
              {formatUsd(standard.totalCents)}
            </span>
            <span className="text-sm" style={{ color: INK_3 }}>
              one-time
            </span>
          </div>
          <p className="mb-5 mt-2 text-[12.5px]" style={{ color: INK_3 }}>
            Then {formatUsd(siteMaint.perMonthCents)}/mo maintenance after
            launch ({siteMaint.billedLabel}) — hosting, SSL, Pro widget, and 1
            content tweak/month included, no separate{' '}
            {formatUsd(widgetSub.monthlyCents)}/mo widget fee.
          </p>
          <PricingFeatureList features={STANDARD_FEATURES} />
          <div className="mt-auto flex flex-col gap-2">
            <Link
              href="/get-started?tier=standard"
              className="flex w-full items-center justify-center rounded-full border px-5 py-3 text-sm font-medium transition hover:border-[#8B939C]"
              style={{ borderColor: HAIRLINE_2, color: INK }}
            >
              Start a Standard build
            </Link>
            <p className="text-center text-[12px]" style={{ color: INK_3 }}>
              Nothing due until you approve the site
            </p>
          </div>
        </div>

        {/* AI Premium — featured, inverted ink card */}
        <div
          className="landing-shadow-panel flex flex-col rounded-2xl p-7"
          style={{ background: INK, color: BG }}
        >
          <p
            className="mb-3 text-xs font-medium"
            style={{ color: 'rgba(251,251,250,0.6)' }}
          >
            Site build · Recommended
          </p>
          <h3 className="text-lg font-semibold tracking-tight">
            {premium.label}
          </h3>
          <p
            className="mb-5 text-[13.5px]"
            style={{ color: 'rgba(251,251,250,0.75)' }}
          >
            Ten pages, written and art-directed for your market
          </p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[42px] font-medium tracking-[-0.03em] tabular-nums leading-none">
              {formatUsd(premium.totalCents)}
            </span>
            <span className="text-sm" style={{ color: 'rgba(251,251,250,0.55)' }}>
              one-time
            </span>
          </div>
          <p
            className="mb-5 mt-2 text-[12.5px]"
            style={{ color: 'rgba(251,251,250,0.6)' }}
          >
            Then {formatUsd(siteMaint.perMonthCents)}/mo maintenance after
            launch ({siteMaint.billedLabel}) — same coverage as Standard, plus
            2 revision rounds in your first 30 days (included in the build).
          </p>
          <PricingFeatureList features={PREMIUM_FEATURES} inverted />
          <div className="mt-auto flex flex-col gap-2">
            <Link
              href="/get-started?tier=ai_premium"
              className="flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-medium transition hover:opacity-90"
              style={{ background: BG, color: INK }}
            >
              Start a Premium build
            </Link>
            <p
              className="text-center text-[12px]"
              style={{ color: 'rgba(251,251,250,0.6)' }}
            >
              {formatUsd(premium.depositCents)} deposit · balance only on
              approval · not satisfied? deposit returned
            </p>
          </div>
        </div>
      </div>

      {/* Demo portfolio showcase */}
      <div id="portfolio" className="mt-24">
        <p className="mb-3 text-[13px] font-semibold" style={{ color: ACCENT }}>
          Site builds
        </p>
        <h3 className="max-w-[26ch] text-2xl font-medium tracking-[-0.025em] sm:text-[32px] sm:leading-[1.15]">
          Three looks, all live right now
        </h3>
        <p
          className="mt-4 max-w-[60ch] text-[15px] leading-relaxed"
          style={{ color: INK_2 }}
        >
          Each one is a working site for a demo business, not a screenshot.
          Open it, click around, run a quote — your build starts from the one
          you pick.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
          {[
            {
              name: 'Lumina',
              style: 'Minimal · Luxury',
              image: '/lumina_mockup.png',
              link: 'https://lumina.ditchtheform.com',
            },
            {
              name: 'Ironclad',
              style: 'Bold · Industrial',
              image: '/ironclad_mockup.png',
              link: 'https://ironclad.ditchtheform.com',
            },
            {
              name: 'Hearth & Home',
              style: 'Warm · Traditional',
              image: '/hearth_home_mockup.png',
              link: 'https://hearth.ditchtheform.com',
            },
          ].map((demo) => (
            <a
              key={demo.name}
              href={demo.link}
              target="_blank"
              rel="noopener noreferrer"
              className="landing-shadow-card group block overflow-hidden rounded-2xl border bg-white transition-transform duration-200 hover:-translate-y-1"
              style={{ borderColor: HAIRLINE }}
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden border-b" style={{ borderColor: HAIRLINE }}>
                <Image
                  src={demo.image}
                  alt={`${demo.name} site design`}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </div>
              <div className="flex items-baseline justify-between px-5 py-3.5">
                <span className="text-[14.5px] font-semibold tracking-tight">
                  {demo.name}
                </span>
                <span className="text-xs" style={{ color: INK_3 }}>
                  {demo.style}
                </span>
              </div>
            </a>
          ))}
        </div>

        <HowSiteBuildPaymentWorks />
      </div>
    </section>
  )
}
