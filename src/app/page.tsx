'use client'

import { useState, useEffect, useCallback } from 'react'
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
import {
  useScrollReveal,
  useScrollRevealChildren,
} from '@/hooks/useScrollReveal'

/* ── Rotating industry word — keeps the hero focused but inclusive ── */
const INDUSTRIES = [
  'closet designers',
  'plumbers',
  'landscapers',
  'pressure washers',
  'towing companies',
  'tree services',
]

function RotatingText() {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex((i) => (i + 1) % INDUSTRIES.length)
        setVisible(true)
      }, 300)
    }, 2800)
    return () => clearInterval(interval)
  }, [])

  return (
    <span
      className="inline-block text-gradient-accent transition-all duration-300"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
      }}
    >
      {INDUSTRIES[index]}
    </span>
  )
}

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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="start-choice-heading"
    >
      <div
        className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-[#0d0d0d] p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-5 top-5 text-slate-500 transition hover:text-white"
        >
          ✕
        </button>

        <h3 id="start-choice-heading" className="text-xl font-bold tracking-tight text-white">
          Which one are you?
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          The 30-day free trial is for the embeddable quote calculator widget. If you
          don&apos;t have a site to embed it on yet, we build one for you — with the
          calculator already wired in.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => router.push('/signup/pro')}
            className="flex flex-col items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left transition hover:border-white/25 hover:bg-white/[0.06]"
          >
            <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-white">
              30-day free trial
            </span>
            <span className="mt-2 text-sm font-semibold text-white">
              I already have a website
            </span>
            <span className="text-xs leading-relaxed text-slate-400">
              Just embed the instant quote calculator on your existing site. No card
              required to start.
            </span>
          </button>

          <button
            type="button"
            onClick={() => router.push('/get-started?tier=ai_premium')}
            className="flex flex-col items-start gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-950/20 p-5 text-left transition hover:border-emerald-500/40 hover:bg-emerald-950/30"
          >
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-emerald-300">
              From $999
            </span>
            <span className="mt-2 text-sm font-semibold text-white">
              I don&apos;t have a website yet
            </span>
            <span className="text-xs leading-relaxed text-slate-300">
              We&apos;ll design and build you a full marketing site — your quote
              calculator comes built in. Compare plans below.
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

  return (
    <div className="noise-overlay min-h-screen bg-[#0a0a0a] text-white selection:bg-white/20 selection:text-white">
      <Script
        src={WIDGET_CDN_URL}
        strategy="lazyOnload"
      />

      {/* ─── Nav ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-tight">
              Ditch<span className="text-slate-400">TheForm</span>
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="#pricing"
              className="hidden text-xs font-medium text-slate-500 transition hover:text-white sm:inline"
            >
              Pricing
            </a>
            {isLoggedIn ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-xs font-medium text-slate-400 transition hover:text-white"
                >
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  disabled={signingOut}
                  className="rounded-full border border-white/10 px-4 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-white/20 hover:text-white active:scale-[0.97] disabled:opacity-50"
                >
                  {signingOut ? 'Signing out…' : 'Sign Out'}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-xs font-medium text-slate-500 transition hover:text-white"
                >
                  Sign In
                </Link>
                <button
                  type="button"
                  onClick={() => setShowStartModal(true)}
                  className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-black transition hover:bg-slate-200 active:scale-[0.97]"
                >
                  Start Free
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
      <section className="relative mx-auto max-w-4xl px-6 pt-40 pb-28 text-center overflow-hidden">
        {/* Aurora glow — the single highest-impact visual upgrade */}
        <div className="aurora" aria-hidden="true" />

        {/* Launch banner — tighter trust copy */}
        <div className="relative z-10 mb-8 inline-flex flex-col items-center gap-1.5 rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.04] px-6 py-3">
          <div className="flex items-center gap-2.5 text-[13px] sm:text-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
            </span>
            <span className="font-semibold uppercase tracking-wider text-emerald-300/90">
              Free for 30 days
            </span>
            <span className="text-slate-500">or</span>
            <a
              href={`/login?email=${encodeURIComponent(DEMO_LOGIN.email)}&password=${encodeURIComponent(DEMO_LOGIN.password)}`}
              className="font-medium text-emerald-200/90 underline decoration-emerald-400/40 decoration-dotted underline-offset-4 transition-colors hover:text-emerald-100 hover:decoration-emerald-300"
            >
              try our demo
            </a>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-500">
            No credit card required · Cancel anytime · No per-lead fees
          </p>
        </div>

        <h1 className="relative z-10 text-5xl font-bold tracking-tighter leading-[1.05] sm:text-6xl md:text-7xl lg:text-[5.25rem]">
          <span className="text-gradient">Turn Your Website Into a</span>
          <br />
          <span className="text-gradient">Lead-Closing Machine</span>
          <br />
          <span className="text-slate-500">
            for <RotatingText />
          </span>
        </h1>

        <p className="relative z-10 mx-auto mt-8 max-w-lg text-lg leading-relaxed text-slate-400 sm:text-xl">
          Embed an interactive pricing calculator on your site. Visitors
          quote themselves, upsell add-ons, and text the lead straight
          to your phone.
        </p>

        <div className="relative z-10 mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => setShowStartModal(true)}
            className="btn-shimmer group rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-black transition-all hover:bg-slate-100 active:scale-[0.97]"
          >
            Start Your Free Trial
            <span className="ml-2 inline-block transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </button>
          <a
            href="#pricing"
            className="rounded-full border border-white/10 px-8 py-3.5 text-sm font-medium text-slate-400 transition hover:border-white/20 hover:text-white"
          >
            Need a full site? From $999
          </a>
        </div>
      </section>

      {/* ─── Social Proof Metrics Bar ─── */}
      <section className="mx-auto max-w-4xl px-6 pb-20">
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 rounded-2xl border border-white/[0.06] bg-white/[0.015] px-8 py-5">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Trusted by service businesses
          </p>
          <div className="hidden sm:block h-4 w-px bg-white/[0.08]" />
          {[
            { value: '60s', label: 'avg. install time' },
            { value: 'SMS + Email', label: 'lead delivery' },
            { value: '$0', label: 'to start' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <span className="font-mono text-sm font-bold text-white">{stat.value}</span>
              <span className="ml-1.5 text-[11px] text-slate-600">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Live Demo Showcase ─── */}
      <section id="demo" className="relative mx-auto max-w-6xl px-6 pb-32">
        {/* Radial glow centered behind the widget column */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-end">
          <div className="h-[500px] w-[500px] rounded-full bg-white/[0.03] blur-[100px]" />
        </div>

        <div className="relative grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          {/* ── Left column: Instructional walkthrough ── */}
          <div className="order-1">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Live demo
            </p>
            <h2 className="mb-6 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Test drive the engine
            </h2>
            <p className="mb-10 max-w-md text-base leading-relaxed text-slate-400">
              This isn&apos;t a screenshot. It&apos;s the real widget your
              customers will use — wired to a live demo business. Walk through
              the flow in 30 seconds:
            </p>

            {/* Step list with vertical timeline accent */}
            <ol className="relative space-y-6 text-lg text-slate-400">
              {/* Thin vertical line connecting the step bullets */}
              <span
                aria-hidden
                className="pointer-events-none absolute left-[15px] top-3 bottom-3 w-px bg-gradient-to-b from-white/20 via-white/[0.06] to-transparent"
              />
              {[
                {
                  n: '01',
                  text: 'Pick a service or job type to see custom pricing kick in.',
                },
                {
                  n: '02',
                  text: 'Enter the size of the job — square footage, hours, units, or distance.',
                },
                {
                  n: '03',
                  text: 'Choose options and add-ons to see real-time price anchoring.',
                },
                {
                  n: '04',
                  text: 'Submit dummy info to see exactly how you capture the lead.',
                },
              ].map((step) => (
                <li key={step.n} className="relative flex items-start gap-4 pl-0">
                  <span className="relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/15 bg-[#0a0a0c] font-mono text-[11px] font-semibold text-slate-300 shadow-[0_0_20px_-4px_rgba(255,255,255,0.12)]">
                    {step.n}
                  </span>
                  <span className="pt-1 text-[15px] leading-relaxed text-slate-400">
                    {step.text}
                  </span>
                </li>
              ))}
            </ol>

            <p className="mt-10 text-xs font-medium text-slate-500">
              → This is a live, interactive widget. Go ahead — try it.
            </p>
          </div>

          {/* ── Right column: The widget in a mock browser ── */}
          <div className="order-2">
            <div
              className="relative rounded-3xl border border-white/10 bg-white/[0.02] p-3 shadow-2xl shadow-black/50"
              style={{
                // Promote to its own compositing layer so scroll over the
                // fixed blurred nav doesn't keep repainting the widget
                // (Chromium backdrop-filter + overflow:hidden flicker bug).
                transform: 'translateZ(0)',
                willChange: 'transform',
                contain: 'paint',
              }}
            >
              {/* Clean browser tab — no fake dots */}
              <div className="mb-3 flex items-center justify-between px-4 pt-2">
                <span className="text-[10px] font-medium text-slate-500">Preview</span>
                <div className="rounded-md bg-white/[0.04] px-8 py-1">
                  <span className="text-[10px] text-slate-500 font-mono">
                    yourwebsite.com
                  </span>
                </div>
                <span className="text-[10px] text-transparent">Preview</span>
              </div>

              {/* Widget container */}
              <div className="rounded-2xl bg-white overflow-hidden">
                <closet-quote-widget
                  data-contractor-id={DEMO_CONTRACTOR_ID}
                  data-api-url={PUBLIC_API_URL}
                />
              </div>
            </div>

            {/* Daily reset notice — tells prospects the demo is shared
                state and will revert nightly so they don't feel hesitant
                to click around. Matches the banner shown in the demo
                account's admin dashboard. */}
            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-slate-400">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />
                <p className="leading-relaxed">
                  <span className="font-semibold text-slate-200">{DEMO_RESET_NOTICE.short}</span>{' '}
                  <span className="text-slate-500">
                    This widget is wired to a shared demo business — feel
                    free to add services, options, or add-ons after signing in.
                    Everything resets to the default demo configuration
                    nightly so the next prospect sees the polished baseline.
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/[0.06] pt-3 pl-5 text-slate-500">
                <span className="font-semibold text-slate-300">Demo login:</span>
                <span>
                  email{' '}
                  <span className="font-mono text-slate-200">{DEMO_LOGIN.email}</span>
                </span>
                <span>
                  password{' '}
                  <span className="font-mono text-slate-200">{DEMO_LOGIN.password}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Divider ─── */}
      <div className="mx-auto max-w-6xl border-t border-white/[0.06]" />

      {/* ─── Value Props — Bento Grid ─── */}
      <section className="mx-auto max-w-5xl px-6 py-32">
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            How it works
          </p>
          <h2 className="text-4xl font-bold tracking-tighter text-gradient sm:text-5xl">
            Three steps to more leads
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Box 1 — Pricing Control (warm tint) — spans 2 cols */}
          <div className="card-lift group relative overflow-hidden rounded-3xl border border-amber-500/[0.08] bg-amber-500/[0.02] p-8 backdrop-blur-sm md:col-span-2">
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-amber-500/[0.03] blur-3xl transition-all duration-700 group-hover:bg-amber-400/[0.06]" />
            <div className="relative">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                <span className="font-mono text-[11px] text-slate-500">01</span>
              </div>
              <h3 className="mb-3 text-2xl font-bold tracking-tight">
                Total Pricing Control
              </h3>
              <p className="max-w-md text-sm leading-relaxed text-slate-400">
                Ditch the one-size-fits-all model. Use our dynamic pricing matrix
                to set custom rates for every service, job type, or package you
                offer — per unit, flat tiers, or base-plus-distance. Add your own
                options, toggle off what you don&apos;t carry, and protect your margins.
              </p>

              {/* Mini UI mockup — sample Walk-In Closet rates (matches demo) */}
              <div className="mt-8 grid grid-cols-3 gap-3">
                {[
                  { tier: 'Basic', price: '$45' },
                  { tier: 'Standard', price: '$75' },
                  { tier: 'Premium', price: '$140' },
                ].map(({ tier, price }) => (
                  <div
                    key={tier}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-colors hover:border-white/[0.12]"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                      {tier}
                    </span>
                    <div className="mt-1 font-mono text-lg font-bold text-white/80">
                      {price}
                    </div>
                    <span className="text-[10px] text-slate-600">/unit</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Box 2 — Upsell Engine (cool tint) — 1 col */}
          <div className="card-lift group relative overflow-hidden rounded-3xl border border-indigo-500/[0.08] bg-indigo-500/[0.02] p-8 backdrop-blur-sm">
            <div className="absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-indigo-500/[0.03] blur-3xl transition-all duration-700 group-hover:bg-indigo-400/[0.06]" />
            <div className="relative">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                <span className="font-mono text-[11px] text-slate-500">02</span>
              </div>
              <h3 className="mb-3 text-2xl font-bold tracking-tight">
                Custom Upsell
                <br />
                Engine
              </h3>
              <p className="text-sm leading-relaxed text-slate-400">
                Create unlimited custom add-ons — from premium materials to
                priority scheduling. Customers upsell themselves before you
                even pick up the phone.
              </p>

              {/* Code snippet mockup — with real syntax colors */}
              <div className="mt-8 overflow-hidden rounded-xl border border-white/[0.06] bg-black/60">
                <div className="flex items-center gap-2 border-b border-white/[0.04] px-3 py-2">
                  <span className="text-[10px] text-slate-600 font-mono">index.html</span>
                </div>
                <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-slate-500">
                  <code>
                    <span className="text-slate-600">&lt;</span>
                    <span className="text-sky-400">closet-quote-widget</span>
                    <br />
                    {'  '}
                    <span className="text-violet-400">data-contractor-id</span>
                    <span className="text-slate-600">=</span>
                    <span className="text-emerald-400">&quot;...&quot;</span>
                    <br />
                    <span className="text-slate-600">/&gt;</span>
                  </code>
                </pre>
              </div>
            </div>
          </div>

          {/* Box 3 — Lead Capture (emerald tint) — spans full width */}
          <div className="card-lift group relative overflow-hidden rounded-3xl border border-emerald-500/[0.08] bg-emerald-500/[0.02] p-8 backdrop-blur-sm md:col-span-3">
            <div className="absolute right-1/4 -top-16 h-48 w-48 rounded-full bg-emerald-500/[0.02] blur-3xl transition-all duration-700 group-hover:bg-emerald-400/[0.05]" />
            <div className="relative md:flex md:items-start md:gap-12">
              <div className="flex-1">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                  <span className="font-mono text-[11px] text-slate-500">03</span>
                </div>
                <h3 className="mb-3 text-2xl font-bold tracking-tight">
                  Instant Lead Capture
                </h3>
                <p className="max-w-lg text-sm leading-relaxed text-slate-400">
                  Copy one snippet of code to embed the calculator on any site.
                  When customers lock in their estimate, their selected service,
                  job size, and chosen options are texted directly to your phone
                  via Twilio SMS — alongside a polished email confirmation for
                  your records.
                </p>
              </div>

              {/* Stats — verifiable claims only */}
              <div className="mt-8 grid flex-shrink-0 grid-cols-3 gap-6 md:mt-0 md:gap-10">
                {[
                  { value: '< 60s', label: 'To install' },
                  { value: '$0', label: 'For 30 days' },
                  { value: 'SMS', label: 'Lead alerts' },
                ].map((stat) => (
                  <div key={stat.label} className="text-center md:text-left">
                    <div className="font-mono text-3xl font-bold tracking-tight text-white">
                      {stat.value}
                    </div>
                    <div className="mt-1 text-xs text-slate-600">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Divider ─── */}
      <div className="mx-auto max-w-6xl border-t border-white/[0.06]" />

      {/* ─── Pricing ─── */}
      <PricingSection />

      {/* ─── Divider ─── */}
      <div className="mx-auto max-w-6xl border-t border-white/[0.06]" />

      {/* ─── Final CTA ─── */}
      <section className="relative mx-auto max-w-3xl px-6 py-32 text-center overflow-hidden">
        {/* Subtle aurora behind CTA too */}
        <div className="aurora" aria-hidden="true" style={{ opacity: 0.6 }} />
        <h2 className="relative z-10 text-4xl font-bold tracking-tighter text-gradient sm:text-5xl">
          Your competitors are still
          <br />
          using contact forms
        </h2>
        <p className="relative z-10 mx-auto mt-6 max-w-md text-slate-400">
          Replace dead forms with interactive quotes, bookings, and orders —
          then get the lead on your phone.
        </p>
        <button
          type="button"
          onClick={() => setShowStartModal(true)}
          className="btn-shimmer group relative z-10 mt-10 inline-flex items-center rounded-full bg-white px-8 py-4 text-sm font-semibold text-black transition-all hover:bg-slate-100 active:scale-[0.97]"
        >
          Start Your Free Trial
          <span className="ml-2 inline-block transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </button>
      </section>

      {/* ─── Gradient separator ─── */}
      <div className="mx-auto max-w-6xl h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />

      {/* ─── Footer ─── */}
      <footer className="py-16">
        <div className="mx-auto max-w-6xl px-6">
          {/* Footer grid */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {/* Brand column */}
            <div className="col-span-2 sm:col-span-1">
              <span className="text-sm font-bold tracking-tight">
                Ditch<span className="text-slate-400">TheForm</span>
              </span>
              <p className="mt-3 text-xs leading-relaxed text-slate-600 max-w-[200px]">
                Interactive quote calculators for service businesses.
                More leads, less friction.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">Product</h4>
              <ul className="space-y-2.5">
                <li><a href="#demo" className="text-xs text-slate-600 transition hover:text-slate-300">Live Demo</a></li>
                <li><a href="#pricing" className="text-xs text-slate-600 transition hover:text-slate-300">Pricing</a></li>
                <li><a href="#portfolio" className="text-xs text-slate-600 transition hover:text-slate-300">Portfolio</a></li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">Company</h4>
              <ul className="space-y-2.5">
                <li><a href="mailto:support@ditchtheform.com" className="text-xs text-slate-600 transition hover:text-slate-300">Contact</a></li>
              </ul>
            </div>

            {/* Account */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">Account</h4>
              <ul className="space-y-2.5">
                {isLoggedIn ? (
                  <>
                    <li>
                      <Link href="/dashboard" className="text-xs text-slate-600 transition hover:text-slate-300">
                        Dashboard
                      </Link>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => void handleSignOut()}
                        disabled={signingOut}
                        className="text-xs text-slate-600 transition hover:text-slate-300 disabled:opacity-50"
                      >
                        {signingOut ? 'Signing out…' : 'Sign Out'}
                      </button>
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <Link href="/login" className="text-xs text-slate-600 transition hover:text-slate-300">
                        Sign In
                      </Link>
                    </li>
                    <li>
                      <Link href="/signup" className="text-xs text-slate-600 transition hover:text-slate-300">
                        Sign Up
                      </Link>
                    </li>
                  </>
                )}
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="mt-12 flex items-center justify-between border-t border-white/[0.04] pt-6">
            <span className="text-[11px] text-slate-700">
              © {new Date().getFullYear()} DitchTheForm. All rights reserved.
            </span>
            <div className="flex items-center gap-4">
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-700 transition hover:text-slate-400"
                aria-label="Twitter"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-700 transition hover:text-slate-400"
                aria-label="LinkedIn"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>
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
  'Managed hosting, SSL & DitchTheForm Pro (ongoing)',
]

const PREMIUM_FEATURES = [
  'Everything in Standard',
  'Up to 10 pages — Home plus 9 you choose during setup',
  'AI-written selling copy for every page — no blank or placeholder content',
  'Custom AI hero & service photos (you pick during setup)',
  'Photoreal, art-directed imagery — no generic AI-looking renders',
  'AI art-directed site copy & calculator config',
  'Up to 3 generations per image (3 options each)',
  'Same intake flow — build + maintenance match what you see',
]

function HowSiteBuildPaymentWorks() {
  const standard = getTierCatalog().find((t) => t.slug === 'standard')!
  const premium = getTierCatalog().find((t) => t.slug === 'ai_premium')!
  const maintenance = getSiteMaintenancePricing()

  return (
    <div className="mt-16 rounded-3xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-sm sm:p-12">
      <div className="mb-10 text-center">
        <h4 className="mb-4 text-2xl font-bold tracking-tight text-white">
          Pay when you&apos;re satisfied — not before
        </h4>
        <p className="mx-auto max-w-2xl text-slate-400">
          Start at{' '}
          <Link href="/get-started" className="text-emerald-300 underline underline-offset-2">
            /get-started
          </Link>
          . Intake shows the same options. After launch, site maintenance is{' '}
          {formatUsd(maintenance.monthlyCents)}/mo or {formatUsd(maintenance.yearlyCents)}/yr (save{' '}
          {formatUsd(maintenance.yearlySavingsCents)}).
        </p>
      </div>

      <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.08] bg-black/40 p-6 text-left">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Standard · {formatUsd(standard.totalCents)}
          </p>
          <p className="mt-3 text-lg font-semibold text-white">No upfront deposit</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            We build your site with stock imagery. You pay the full{' '}
            {formatUsd(standard.totalCents)} only when you&apos;re happy with the preview — nothing due
            until then. Once paid, we launch the site and hand you the keys (full access to your
            dashboard, leads, and settings).
          </p>
          <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
            <p className="text-xs font-medium text-slate-300">Due today</p>
            <p className="text-2xl font-bold text-white">$0</p>
            <p className="mt-1 text-xs text-slate-500">
              {formatUsd(standard.totalCents)} when satisfied, then launch.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-950/20 p-6 text-left">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400/90">
            AI Premium · {formatUsd(premium.totalCents)}
          </p>
          <p className="mt-3 text-lg font-semibold text-white">Deposit unlocks AI studio</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            Pay {formatUsd(premium.depositCents)} (30%) on intake to generate custom hero and product
            images. We build with the shots you choose. The remaining{' '}
            {formatUsd(premium.remainderCents)} is only due if you&apos;re satisfied before launch.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-emerald-500/20 bg-black/30 px-4 py-3">
              <p className="text-xs font-medium text-emerald-300/90">Due today (30%)</p>
              <p className="text-2xl font-bold text-white">{formatUsd(premium.depositCents)}</p>
              <p className="mt-1 text-xs text-slate-500">Unlocks AI image studio on intake.</p>
            </div>
            <div className="rounded-lg border border-emerald-500/20 bg-black/30 px-4 py-3">
              <p className="text-xs font-medium text-emerald-300/90">If you love it</p>
              <p className="text-2xl font-bold text-white">{formatUsd(premium.remainderCents)}</p>
              <p className="mt-1 text-xs text-slate-500">Before launch, then keys to the kingdom.</p>
            </div>
          </div>
          <p className="mt-4 text-xs font-medium text-emerald-200/90 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
            Not satisfied? You don&apos;t pay the balance — your deposit is returned.
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
    <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
      <button
        type="button"
        onClick={() => onBillingChange('monthly')}
        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
          billing === 'monthly' ? 'bg-white text-black' : 'text-slate-400 hover:text-white'
        }`}
      >
        {monthlyLabel}
      </button>
      <button
        type="button"
        onClick={() => onBillingChange('yearly')}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
          billing === 'yearly' ? 'bg-white text-black' : 'text-slate-400 hover:text-white'
        }`}
      >
        {yearlyLabel}
        {savingsCents > 0 && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
              billing === 'yearly'
                ? 'bg-black/10 text-black'
                : 'bg-emerald-400/10 text-emerald-300'
            }`}
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
  accent = 'default',
}: {
  features: string[]
  accent?: 'default' | 'emerald'
}) {
  return (
    <ul className="mb-8 space-y-3">
      {features.map((feature) => (
        <li key={feature} className="flex items-start gap-3 text-sm text-slate-300">
          <span
            className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border ${
              accent === 'emerald'
                ? 'border-emerald-500/20 bg-emerald-500/10'
                : 'border-white/10 bg-white/[0.04]'
            }`}
          >
            <Check
              className={`h-3 w-3 ${accent === 'emerald' ? 'text-emerald-400' : 'text-white'}`}
              strokeWidth={3}
            />
          </span>
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
    <section id="pricing" className="mx-auto max-w-7xl px-6 py-32">
      <div className="mb-12 text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Pricing
        </p>
        <h2 className="text-4xl font-bold tracking-tighter text-gradient sm:text-5xl">
          Simple, transparent pricing
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base text-slate-400">
          Three ways to grow leads: embed the widget on your existing site, or let us build a
          full marketing site. Site-build one-time fees match intake; maintenance applies after launch.
        </p>
      </div>

      <p className="mb-4 text-center text-xs font-medium uppercase tracking-wider text-slate-500">
        Monthly or yearly — applies to Pro subscription and site maintenance. Build fees are one-time.
      </p>
      <div className="mb-10 flex flex-col items-center gap-2">
        <PlanBillingToggle
          billing={billing}
          onBillingChange={setBilling}
          savingsCents={maxYearlySavingsCents}
          monthlyLabel="Monthly"
          yearlyLabel="Yearly"
        />
        {billing === 'yearly' && (
          <p className="text-center text-[11px] text-slate-500">
            Pro widget saves {formatUsd(widgetSub.yearlySavingsCents)}/yr · Site maintenance saves{' '}
            {formatUsd(maintenance.yearlySavingsCents)}/yr vs paying monthly
          </p>
        )}
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Widget only — first tier */}
        <div className="relative flex flex-col rounded-3xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-sm transition-all hover:bg-white/[0.03] lg:p-9">
          <div className="absolute right-5 top-5">
            <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-white">
              30-Day Free Trial
            </span>
          </div>
          <p className="mb-0.5 text-sm font-medium text-slate-400">Already have a website?</p>
          <p className="mb-4 text-lg font-semibold text-white">DitchTheForm Pro</p>
          <div className="mb-1 flex items-baseline gap-2">
            <span className="text-5xl font-bold tracking-tighter text-white lg:text-6xl">
              {formatUsd(widgetDisplay.perMonthCents)}
            </span>
            <span className="text-sm text-slate-400">/mo</span>
          </div>
          <p className="mb-4 text-xs text-slate-500">{widgetDisplay.billedLabel}</p>
          <p className="mb-4 text-xs font-medium text-slate-200 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2">
            <span className="text-white font-semibold">$0 for 30 days</span> — full widget access, no
            card required to start. After day 30,{' '}
            {formatUsd(widgetSub.monthlyCents)}/mo (or{' '}
            {formatUsd(widgetSub.yearlyCents)}/yr) unless you cancel. Prefer to skip the trial? Subscribe
            immediately when you create your account.
          </p>
          <PricingFeatureList features={WIDGET_FEATURES} />
          <div className="mt-auto flex flex-col gap-2">
            <Link
              href="/signup/pro"
              className="flex w-full items-center justify-center rounded-lg bg-white px-5 py-3.5 text-sm font-semibold text-black transition-colors hover:bg-gray-200 active:scale-[0.99]"
            >
              Start 30-day free trial
            </Link>
            <Link
              href={`/signup/pro?subscribe=1&plan=${billing}`}
              className="flex w-full items-center justify-center rounded-lg border border-white/15 px-5 py-3 text-sm font-medium text-white hover:bg-white/5"
            >
              Subscribe now — skip trial
            </Link>
          </div>
        </div>

        {/* Standard site build */}
        <div className="relative flex flex-col rounded-3xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-sm transition-all hover:bg-white/[0.03] lg:p-9">
          <p className="mb-1 text-sm font-medium text-slate-400">{standard.label}</p>
          <p className="mb-4 text-lg font-semibold text-white">Full site build</p>
          <div className="mb-1 flex items-baseline gap-2">
            <span className="text-5xl font-bold tracking-tighter text-white lg:text-6xl">
              {formatUsd(standard.totalCents)}
            </span>
            <span className="text-sm text-slate-400">one-time</span>
          </div>
          <p className="mb-4 text-sm text-slate-300">
            + {formatUsd(siteMaint.perMonthCents)}/mo after launch
            <span className="block text-xs text-slate-500 mt-0.5">{siteMaint.billedLabel}</span>
          </p>
          <p className="mb-2 text-xs text-slate-400">
            Maintenance includes DitchTheForm Pro — no separate {formatUsd(widgetSub.monthlyCents)}/mo widget fee.
          </p>
          <p className="mb-4 text-xs font-medium text-slate-200 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2">
            No upfront deposit. Pay {formatUsd(standard.totalCents)} when satisfied — then launch and
            full dashboard access.
          </p>
          <PricingFeatureList features={STANDARD_FEATURES} />
          <Link
            href="/get-started?tier=standard"
            className="mt-auto flex w-full items-center justify-center rounded-lg bg-white px-5 py-3.5 text-sm font-semibold text-black transition-colors hover:bg-gray-200 active:scale-[0.99]"
          >
            Get started — Standard
          </Link>
        </div>

        {/* AI Premium */}
        <div className="relative flex flex-col overflow-hidden rounded-3xl border border-emerald-500/30 bg-emerald-950/10 p-8 backdrop-blur-sm shadow-[0_0_40px_-15px_rgba(16,185,129,0.15)] transition-all hover:bg-emerald-950/20 lg:p-9">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
          <div className="absolute right-5 top-5">
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-widest text-emerald-300">
              Most Popular
            </span>
          </div>
          <p className="mb-1 text-sm font-medium text-emerald-400/90">{premium.label}</p>
          <p className="mb-4 text-lg font-semibold text-white">Full site + AI imagery</p>
          <div className="mb-1 flex items-baseline gap-2">
            <span className="text-5xl font-bold tracking-tighter text-white lg:text-6xl">
              {formatUsd(premium.totalCents)}
            </span>
            <span className="text-sm text-slate-400">one-time</span>
          </div>
          <p className="mb-4 text-sm text-emerald-100/90">
            + {formatUsd(siteMaint.perMonthCents)}/mo after launch
            <span className="block text-xs text-emerald-200/60 mt-0.5">{siteMaint.billedLabel}</span>
          </p>
          <p className="mb-2 text-xs text-emerald-200/70">
            Maintenance includes DitchTheForm Pro — no separate widget subscription.
          </p>
          <p className="mb-2 text-xs font-medium text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            30% today: {formatUsd(premium.depositCents)} · Balance{' '}
            {formatUsd(premium.remainderCents)} if satisfied before launch.
          </p>
          <p className="mb-4 text-xs text-emerald-200/80">Not satisfied? Deposit returned.</p>
          <PricingFeatureList features={PREMIUM_FEATURES} accent="emerald" />
          <Link
            href="/get-started?tier=ai_premium"
            className="relative z-10 mt-auto flex w-full items-center justify-center rounded-lg bg-emerald-500 px-5 py-3.5 text-sm font-semibold text-black shadow-[0_0_20px_-5px_rgba(16,185,129,0.4)] transition-all hover:bg-emerald-400 active:scale-[0.99]"
          >
            Get started — AI Premium
          </Link>
        </div>
      </div>

      {/* Demo Portfolio Showcase */}
      <div id="portfolio" className="mt-32 pt-16 border-t border-white/[0.06]">
        <div className="mb-12 text-center">
          <h3 className="text-3xl font-bold tracking-tight text-white mb-4">
            Don&apos;t have a website? Choose your aesthetic
          </h3>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Test drive a live, fully functional digital storefront right now. These aren&apos;t just templates—they are high-converting lead engines wired to your pricing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              name: 'Lumina',
              style: 'Minimalist / Luxury',
              image: '/lumina_mockup.png',
              link: 'https://lumina.ditchtheform.com',
            },
            {
              name: 'Ironclad',
              style: 'Bold / Industrial',
              image: '/ironclad_mockup.png',
              link: 'https://ironclad.ditchtheform.com',
            },
            {
              name: 'Hearth & Home',
              style: 'Warm / Traditional',
              image: '/hearth_home_mockup.png',
              link: 'https://hearth.ditchtheform.com',
            },
          ].map((demo) => (
            <a
              key={demo.name}
              href={demo.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group block"
            >
              <div className="card-lift relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]" style={{ perspective: '800px' }}>
                <Image
                  src={demo.image}
                  alt={`${demo.name} aesthetic`}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100 flex items-center justify-center">
                  <span className="rounded-full bg-white/10 backdrop-blur-md border border-white/20 px-6 py-2 text-sm font-medium text-white shadow-xl">
                    View Live Demo
                  </span>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between px-1">
                <span className="font-semibold text-white">{demo.name}</span>
                <span className="text-xs text-slate-500 uppercase tracking-widest">{demo.style}</span>
              </div>
            </a>
          ))}
        </div>

        <HowSiteBuildPaymentWorks />
      </div>
    </section>
  )
}
