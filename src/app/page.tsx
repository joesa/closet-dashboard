'use client'

import { useState } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import { Check } from 'lucide-react'
import { DEMO_CONTRACTOR_ID, DEMO_LOGIN, DEMO_RESET_NOTICE } from '@/lib/demo'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-white/20 selection:text-white">
      <Script
        src="https://closet-widget.vercel.app/widget.js"
        strategy="lazyOnload"
      />

      {/* ─── Nav ─── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tracking-tight">
              Closet<span className="text-slate-400">Quote</span>
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="#pricing"
              className="hidden text-xs font-medium text-slate-500 transition hover:text-white sm:inline"
            >
              Pricing
            </a>
            <Link
              href="/login"
              className="text-xs font-medium text-slate-500 transition hover:text-white"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-black transition hover:bg-slate-200 active:scale-[0.97]"
            >
              Start Free
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative mx-auto max-w-4xl px-6 pt-40 pb-24 text-center">
        {/* Launch banner — dialed-back emerald so it complements the slate palette
            rather than dominating it. Two lines: headline offer + transparency. */}
        <div className="relative mb-8 inline-flex flex-col items-center gap-1.5 rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.04] px-6 py-3">
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
              try our demo application
            </a>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-400">
            No credit card required · For real · No hidden fees · No hidden agenda here
          </p>
        </div>

        <h1 className="text-5xl font-bold tracking-tighter leading-[1.05] sm:text-6xl md:text-7xl lg:text-[5.25rem]">
          Stop Losing High-End
          <br />
          Leads to Boring
          <br />
          <span className="text-slate-500">Contact Forms.</span>
        </h1>

        <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-slate-400 sm:text-xl">
          Embed an interactive pricing engine in 60 seconds. Lock&nbsp;in
          prices, upsell finishes, and get qualified leads texted directly to
          your phone.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/signup"
            className="group relative rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-black transition-all hover:bg-slate-100 active:scale-[0.97]"
          >
            Start Your 30-Day Free Trial
            <span className="ml-2 inline-block transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
          <a
            href="#demo"
            className="rounded-full border border-white/10 px-8 py-3.5 text-sm font-medium text-slate-400 transition hover:border-white/20 hover:text-white"
          >
            See it live
          </a>
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
              Test drive the engine.
            </h2>
            <p className="mb-10 max-w-md text-base leading-relaxed text-slate-400">
              This isn&apos;t a screenshot. It&apos;s the real widget your
              homeowners will use — wired to a live demo contractor. Walk through
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
                  text: 'Select a room type to see custom icons and pricing kick in.',
                },
                {
                  n: '02',
                  text: 'Drag the slider to input the linear footage of the project.',
                },
                {
                  n: '03',
                  text: 'Choose finishes and add-ons to see real-time price anchoring.',
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
              {/* Fake browser chrome */}
              <div className="mb-3 flex items-center gap-2 px-3 pt-1">
                <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
                <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
                <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
                <div className="mx-auto rounded-md bg-white/[0.04] px-12 py-1">
                  <span className="text-[10px] text-slate-400 font-mono">
                    yourwebsite.com
                  </span>
                </div>
              </div>

              {/* Widget container */}
              <div className="rounded-2xl bg-white overflow-hidden">
                <closet-quote-widget
                  data-contractor-id={DEMO_CONTRACTOR_ID}
                  data-api-url="https://closet-dashboard-orcin.vercel.app"
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
                    This widget is wired to a shared demo contractor — feel
                    free to add rooms, finishes, or add-ons after signing in.
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
      <section className="mx-auto max-w-5xl px-6 py-28">
        <div className="mb-16 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            How it works
          </p>
          <h2 className="text-4xl font-bold tracking-tighter sm:text-5xl">
            Three steps. Zero friction.
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Box 1 — spans 2 cols */}
          <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-sm md:col-span-2">
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/[0.02] blur-3xl transition-all duration-700 group-hover:bg-white/[0.04]" />
            <div className="relative">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                <span className="font-mono text-[11px] text-slate-500">01</span>
              </div>
              <h3 className="mb-3 text-2xl font-bold tracking-tight">
                Total Pricing Control.
              </h3>
              <p className="max-w-md text-sm leading-relaxed text-slate-400">
                Ditch the one-size-fits-all model. Use our dynamic Room Matrix to
                set custom per-foot pricing for Walk-Ins, Garages, Pantries, and
                11 other spaces. Add your own bespoke materials, toggle off what
                you don&apos;t carry, and protect your margins.
              </p>

              {/* Mini UI mockup */}
              <div className="mt-8 grid grid-cols-3 gap-3">
                {['Basic', 'Standard', 'Premium'].map((tier) => (
                  <div
                    key={tier}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                      {tier}
                    </span>
                    <div className="mt-1 font-mono text-lg font-bold text-white/80">
                      $—
                    </div>
                    <span className="text-[10px] text-slate-600">/lin ft</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Box 2 — 1 col */}
          <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-sm">
            <div className="absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-white/[0.02] blur-3xl transition-all duration-700 group-hover:bg-white/[0.04]" />
            <div className="relative">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                <span className="font-mono text-[11px] text-slate-500">02</span>
              </div>
              <h3 className="mb-3 text-2xl font-bold tracking-tight">
                Custom Upsell
                <br />
                Engine.
              </h3>
              <p className="text-sm leading-relaxed text-slate-400">
                Create unlimited custom add-ons — from velvet jewelry trays to
                heavy-duty garage racks. Homeowners upsell themselves before you
                even pick up the phone.
              </p>

              {/* Code snippet mockup */}
              <div className="mt-8 overflow-hidden rounded-xl border border-white/[0.06] bg-black/60">
                <div className="flex items-center gap-1.5 border-b border-white/[0.04] px-3 py-2">
                  <div className="h-2 w-2 rounded-full bg-white/10" />
                  <div className="h-2 w-2 rounded-full bg-white/10" />
                  <div className="h-2 w-2 rounded-full bg-white/10" />
                </div>
                <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-slate-500">
                  <code>
                    <span className="text-slate-600">&lt;</span>
                    <span className="text-white/70">closet-quote-widget</span>
                    <br />
                    {'  '}
                    <span className="text-slate-600">data-contractor-id=</span>
                    <span className="text-emerald-400/60">&quot;...&quot;</span>
                    <br />
                    <span className="text-slate-600">/&gt;</span>
                  </code>
                </pre>
              </div>
            </div>
          </div>

          {/* Box 3 — spans full width */}
          <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-sm md:col-span-3">
            <div className="absolute right-1/4 -top-16 h-48 w-48 rounded-full bg-white/[0.015] blur-3xl transition-all duration-700 group-hover:bg-white/[0.03]" />
            <div className="relative md:flex md:items-start md:gap-12">
              <div className="flex-1">
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                  <span className="font-mono text-[11px] text-slate-500">03</span>
                </div>
                <h3 className="mb-3 text-2xl font-bold tracking-tight">
                  Instant Lead Capture.
                </h3>
                <p className="max-w-lg text-sm leading-relaxed text-slate-400">
                  Copy one snippet of code to embed the calculator on any site.
                  When homeowners lock in their estimate, their room type, linear
                  footage, and selected finishes are texted directly to your phone
                  via Twilio SMS — alongside a polished email confirmation for
                  your records.
                </p>
              </div>

              {/* Stats mockup */}
              <div className="mt-8 grid flex-shrink-0 grid-cols-3 gap-6 md:mt-0 md:gap-10">
                {[
                  { value: '3.2×', label: 'More leads' },
                  { value: '< 60s', label: 'To install' },
                  { value: '$0', label: 'For 30 days' },
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
      <section className="mx-auto max-w-3xl px-6 py-28 text-center">
        <h2 className="text-4xl font-bold tracking-tighter sm:text-5xl">
          Your competitors are still
          <br />
          using contact forms.
        </h2>
        <p className="mx-auto mt-6 max-w-md text-slate-400">
          Give homeowners an instant, interactive quote — and watch your close
          rate climb.
        </p>
        <Link
          href="/signup"
          className="group mt-10 inline-flex items-center rounded-full bg-white px-8 py-4 text-sm font-semibold text-black transition-all hover:bg-slate-100 active:scale-[0.97]"
        >
          Start Your 30-Day Free Trial
          <span className="ml-2 inline-block transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </Link>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-white/[0.06] py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
          <span className="text-xs text-slate-600">
            © {new Date().getFullYear()} ClosetQuote
          </span>
          <div className="flex gap-6">
            <Link
              href="/login"
              className="text-xs text-slate-600 transition hover:text-slate-400"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="text-xs text-slate-600 transition hover:text-slate-400"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ─── Pricing section ─────────────────────────────────────────────── */

const PRO_FEATURES = [
  'Interactive quote widget',
  'Unlimited lead capture via SMS & email',
  'Custom room & finish pricing',
  'Dynamic add-on manager',
  'No limits on traffic or quotes',
]

const AGENCY_FEATURES = [
  'Everything in ClosetQuote Pro',
  'Lightning-fast custom Next.js website',
  'Premium interior architecture photography',
  'Fully managed hosting & SSL (zero maintenance)',
  'Mobile-first design optimized for homeowner conversions',
]

function PricingSection() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const monthlyPrice = 99
  const yearlyPrice = 990 // $82.50/mo billed annually — saves $198/yr
  const displayPrice = billing === 'monthly' ? monthlyPrice : Math.round(yearlyPrice / 12)
  const subLabel = billing === 'monthly' ? '/month' : '/month, billed yearly'

  const agencyMonthlyPrice = 149
  const agencyYearlyPrice = 1490 // Saves $298/yr
  const displayAgencyPrice = billing === 'monthly' ? agencyMonthlyPrice : Math.round(agencyYearlyPrice / 12)

  return (
    <section id="pricing" className="mx-auto max-w-5xl px-6 py-28">
      <div className="mb-12 text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Pricing
        </p>
        <h2 className="text-4xl font-bold tracking-tighter sm:text-5xl">
          Simple, transparent pricing.
        </h2>
        <p className="mx-auto mt-5 max-w-md text-base text-slate-400">
          Everything you need to close more high-end jobs. No hidden fees,
          no per-lead charges.
        </p>
      </div>

      {/* Billing toggle */}
      <div className="mb-10 flex justify-center">
        <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
          <button
            type="button"
            onClick={() => setBilling('monthly')}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
              billing === 'monthly'
                ? 'bg-white text-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBilling('yearly')}
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition ${
              billing === 'yearly'
                ? 'bg-white text-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Yearly
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                billing === 'yearly'
                  ? 'bg-black/10 text-black'
                  : 'bg-emerald-400/10 text-emerald-300'
              }`}
            >
              Save $198
            </span>
          </button>
        </div>
      </div>

      {/* Pricing cards */}
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Widget Only Card */}
        <div className="relative rounded-3xl border border-white/10 bg-white/[0.02] p-10 backdrop-blur-sm transition-all hover:bg-white/[0.03]">
          <div className="absolute right-6 top-6">
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-white">
              30-Day Free Trial
            </span>
          </div>

          <p className="mb-1 text-sm font-medium text-slate-400">
            ClosetQuote Pro
          </p>
          <div className="mb-2 flex items-baseline gap-2">
            <span className="text-6xl font-bold tracking-tighter text-white">
              ${displayPrice}
            </span>
            <span className="text-sm text-slate-400">{subLabel}</span>
          </div>
          <p className="mb-8 text-xs text-slate-500 min-h-[32px]">
            Add instant quoting to your existing website.
            <br />
            <span className="opacity-80">
              {billing === 'yearly'
                ? `$${yearlyPrice} billed once a year. Cancel anytime.`
                : 'Billed monthly. Cancel anytime.'}
            </span>
          </p>

          <ul className="mb-10 space-y-3">
            {PRO_FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-sm text-slate-300">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </span>
                {feature}
              </li>
            ))}
          </ul>

          <Link
            href="/signup"
            className="flex w-full items-center justify-center rounded-lg bg-white px-6 py-4 text-base font-medium text-black transition-colors hover:bg-gray-200 active:scale-[0.99]"
          >
            Start your free 30-day trial
          </Link>
          <p className="mt-4 text-center text-xs text-slate-500">
            No credit card required.
          </p>
        </div>

        {/* Agency Build Card */}
        <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-emerald-950/10 p-10 backdrop-blur-sm shadow-[0_0_40px_-15px_rgba(16,185,129,0.15)] transition-all hover:bg-emerald-950/20">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
          <div className="absolute right-6 top-6">
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-emerald-300">
              Most Popular
            </span>
          </div>

          <p className="mb-1 text-sm font-medium text-emerald-400/90">
            Complete Agency Build
          </p>
          <div className="mb-2 flex items-baseline gap-2">
            <span className="text-6xl font-bold tracking-tighter text-white">
              ${displayAgencyPrice}
            </span>
            <span className="text-sm text-slate-400">{subLabel}</span>
          </div>
          <p className="mb-8 text-xs text-slate-500 min-h-[32px]">
            A premium, bespoke website with the lead engine built natively inside.
            <br />
            <span className="opacity-80">
              $1,500 one-time setup fee. {billing === 'yearly' ? `$${agencyYearlyPrice} billed annually.` : 'Billed monthly.'}
            </span>
          </p>

          <ul className="mb-10 space-y-3">
            {AGENCY_FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-sm text-slate-300">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10">
                  <Check className="h-3 w-3 text-emerald-400" strokeWidth={3} />
                </span>
                {feature}
              </li>
            ))}
          </ul>

          <a
            href="mailto:joe@closetquotes.com?subject=Inquiry: Complete Agency Build"
            className="flex w-full relative z-10 items-center justify-center rounded-lg bg-emerald-500 px-6 py-4 text-base font-medium text-black shadow-[0_0_20px_-5px_rgba(16,185,129,0.4)] transition-all hover:bg-emerald-400 active:scale-[0.99]"
          >
            Book a Discovery Call
          </a>
          <p className="mt-4 text-center text-xs text-emerald-500/60">
            Limited capacity per month.
          </p>
        </div>
      </div>

      {/* Demo Portfolio Showcase */}
      <div className="mt-32 pt-16 border-t border-white/[0.06]">
        <div className="mb-12 text-center">
          <h3 className="text-3xl font-bold tracking-tight text-white mb-4">
            Don&apos;t have a website? Choose your custom aesthetic.
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
              link: '#',
            },
            {
              name: 'Ironclad',
              style: 'Brutalist / Garage',
              image: '/ironclad_mockup.png',
              link: '#',
            },
            {
              name: 'Hearth & Home',
              style: 'Suburban / Traditional',
              image: '/hearth_home_mockup.png',
              link: '#',
            },
          ].map((demo) => (
            <a key={demo.name} href={demo.link} className="group block">
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
                {/* Image placeholder (since actual next/image requires width/height mapping) */}
                <img 
                  src={demo.image} 
                  alt={`${demo.name} aesthetic`}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
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
      </div>
    </section>
  )
}
