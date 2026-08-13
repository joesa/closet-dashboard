'use client'

import { useState, useEffect, useRef } from 'react'
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

/* Landing palette — shared with the intake flow via @/lib/landingTheme. */
import {
  INK,
  INK_2,
  INK_3,
  BG,
  SURFACE_2,
  HAIRLINE,
  HAIRLINE_2,
  ACCENT,
  ACCENT_SOFT,
} from '@/lib/landingTheme'

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
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
    ) || [])
    focusable()[0]?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-choice-heading"
        className="landing-shadow-panel relative w-full max-w-lg rounded-2xl border bg-white p-8"
        style={{ borderColor: HAIRLINE }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 inline-flex min-h-11 min-w-11 items-center justify-center transition hover:opacity-70"
          style={{ color: INK_3 }}
        >
          ✕
        </button>

        <h3
          id="start-choice-heading"
          className="text-xl font-semibold tracking-tight"
          style={{ color: INK }}
        >
          What are you starting with?
        </h3>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: INK_2 }}>
          The 30-day free trial is for the embeddable quote calculator widget.
          If you don&apos;t have a site to embed it on yet, we build one for
          you, with the calculator already wired in.
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
            onClick={() => router.push('/get-started?tier=custom_studio')}
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
              We&apos;ll design and build you a full marketing site. Your
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
      const timeout = window.setTimeout(() => setShowStartModal(true), 0)
      return () => window.clearTimeout(timeout)
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

  const demoLoginHref = '/login?demo=1'

  return (
    <div
      className="min-h-screen antialiased"
      style={{ background: BG, color: INK }}
    >
      <Script src={WIDGET_CDN_URL} strategy="lazyOnload" />

      {/* ─── Nav ─── */}
      <nav
        className="sticky top-0 z-50 border-b"
        style={{ borderColor: HAIRLINE, background: BG }}
      >
        <div className="mx-auto flex h-[60px] max-w-6xl items-center justify-between px-6">
          <span className="text-[16px] font-semibold tracking-tight">
            Ditch<span style={{ color: INK_3 }}>the</span>Form
          </span>
          <div className="flex items-center gap-6">
            <a
              href="#demo"
              className="hidden min-h-11 items-center text-[13.5px] font-medium transition hover:opacity-70 sm:inline-flex"
              style={{ color: INK_2 }}
            >
              Product
            </a>
            <a
              href="#pricing"
              className="hidden min-h-11 items-center text-[13.5px] font-medium transition hover:opacity-70 sm:inline-flex"
              style={{ color: INK_2 }}
            >
              Pricing
            </a>
            {isLoggedIn ? (
              <>
                <Link
                  href="/dashboard"
                  className="inline-flex min-h-11 items-center text-[13.5px] font-medium transition hover:opacity-70"
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
                  className="inline-flex min-h-11 items-center text-[13.5px] font-medium transition hover:opacity-70"
                  style={{ color: INK_2 }}
                >
                  Sign in
                </Link>
                <button
                  type="button"
                  onClick={() => setShowStartModal(true)}
                  className="inline-flex min-h-11 items-center px-4 py-2 text-[13px] font-medium text-white transition hover:opacity-85 active:scale-[0.98]"
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

      <main>
      {/* ─── Hero: the product's quote-to-phone transaction ─── */}
      <section className="mx-auto grid max-w-6xl gap-12 px-6 pb-16 pt-20 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:pt-24">
        <div>
          <div className="flex items-center gap-3 text-[12px] font-semibold uppercase tracking-[0.12em]" style={{ color: ACCENT }}>
            <span className="h-px w-9" style={{ background: ACCENT }} aria-hidden="true" />
            Quote to phone, on your domain
          </div>
          <h1 className="mt-7 max-w-[12ch] text-[46px] font-medium leading-[1.01] tracking-[-0.045em] sm:text-6xl lg:text-[72px]">
            Price the job while they&apos;re still on your site.
          </h1>
          <p className="mt-6 max-w-[48ch] text-lg leading-relaxed" style={{ color: INK_2 }}>
            Your customer chooses the work. Your rate sheet calculates the price.
            Their number, job details, and quote arrive by SMS and email when they submit.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup/pro"
              className="inline-flex min-h-11 items-center justify-center px-6 py-3 text-sm font-semibold text-white transition hover:opacity-85"
              style={{ background: INK, color: '#FFFFFF', minHeight: 44 }}
            >
              Add quoting to my site
            </Link>
            <Link
              href="/get-started"
              className="inline-flex min-h-11 items-center justify-center border px-6 py-3 text-sm font-semibold transition hover:border-[#626B75]"
              style={{ borderColor: HAIRLINE_2, color: INK }}
            >
              Build my site with it
            </Link>
          </div>
          <p className="mt-5 text-[12.5px]" style={{ color: INK_3 }}>
            Widget trial: 30 days, no card, no per-lead fee.{' '}
            <a href={demoLoginHref} className="inline-flex min-h-11 items-center underline underline-offset-4" style={{ color: INK_2 }}>
              Open the demo account
            </a>
          </p>
        </div>

        <div className="border-y py-2" style={{ borderColor: INK }} aria-label="Example quote calculation and lead delivery">
          <div className="flex items-center justify-between border-b px-1 py-4 text-xs font-semibold uppercase tracking-[0.12em]" style={{ borderColor: HAIRLINE_2 }}>
            <span>Live quote trace</span><span style={{ color: ACCENT }}>Ready</span>
          </div>
          {[
            ['ROOM', 'Walk-in closet · 96 sq ft'],
            ['RATE', '96 × $75 / sq ft', '$7,200'],
            ['OPTIONS', 'Soft-close + LED lighting', '+ $420'],
          ].map(([label, detail, amount]) => (
            <div key={label} className="grid grid-cols-[82px_1fr_auto] gap-3 border-b px-1 py-5 text-sm" style={{ borderColor: HAIRLINE }}>
              <span className="font-mono text-[11px] font-semibold tracking-[0.1em]" style={{ color: INK_3 }}>{label}</span>
              <span>{detail}</span>
              {amount ? <span className="font-mono tabular-nums">{amount}</span> : null}
            </div>
          ))}
          <div className="flex items-end justify-between px-1 py-6">
            <div><div className="text-xs" style={{ color: INK_3 }}>QUOTE LOCKED</div><div className="mt-1 text-sm">Dana R. · SMS + email</div></div>
            <div className="font-mono text-4xl tracking-[-0.04em] tabular-nums">$7,620</div>
          </div>
        </div>
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
            Example run: delivered 8 seconds after submission
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
            This is the real widget wired to a shared demo business. Pick a
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

      {/* ─── What the live demo proves (product facts, not simulated logos) ─── */}
      <section className="border-y" style={{ borderColor: HAIRLINE }} aria-labelledby="demo-proves-heading">
        <div className="mx-auto grid max-w-6xl px-6 sm:grid-cols-[180px_1fr] sm:gap-10">
          <h2 id="demo-proves-heading" className="py-6 text-sm font-semibold">What the demo proves</h2>
          <div className="grid border-t sm:grid-cols-3 sm:border-l sm:border-t-0" style={{ borderColor: HAIRLINE }}>
            {[
              ['YOUR RATES', 'The total comes from the rate sheet in the dashboard.'],
              ['REAL CHOICES', 'Service, size, tier, and add-ons travel with the lead.'],
              ['TWO DELIVERIES', 'The submitted quote is sent by SMS and copied to email.'],
            ].map(([label, copy]) => (
              <div key={label} className="border-b px-5 py-6 last:border-b-0 sm:border-b-0 sm:border-r" style={{ borderColor: HAIRLINE }}>
                <div className="font-mono text-[10px] font-semibold tracking-[0.12em]" style={{ color: ACCENT }}>{label}</div>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: INK_2 }}>{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works: one continuous operating record ─── */}
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
          Everything the calculator quotes comes off a rate sheet you control.
          Change a number in the dashboard and the widget quotes the new price
          immediately. Nothing is averaged or marked up.
        </p>

        <div className="mt-12 border-y" style={{ borderColor: INK }}>
          <div className="grid gap-6 border-b py-8 md:grid-cols-[210px_1fr_300px] md:items-center" style={{ borderColor: HAIRLINE }}>
            <div><div className="font-mono text-[10px] font-semibold tracking-[0.12em]" style={{ color: ACCENT }}>RATE SHEET</div><h3 className="mt-2 text-xl font-semibold">Set the math</h3></div>
            <p className="max-w-[48ch] text-sm leading-relaxed" style={{ color: INK_2 }}>Use per-square-foot rates, flat tiers, base-plus-distance pricing, and the add-ons you actually sell. Turn off anything you do not carry.</p>
            <div className="font-mono text-xs" aria-label="Example rate sheet"><div className="flex justify-between border-b py-2" style={{ borderColor: HAIRLINE }}><span>Basic</span><span>$45 / sq ft</span></div><div className="flex justify-between border-b py-2 font-semibold" style={{ borderColor: ACCENT, color: ACCENT }}><span>Standard</span><span>$75 / sq ft</span></div><div className="flex justify-between py-2"><span>Premium</span><span>$140 / sq ft</span></div></div>
          </div>
          <div className="grid gap-6 border-b py-8 md:grid-cols-[210px_1fr_300px] md:items-center" style={{ borderColor: HAIRLINE }}>
            <div><div className="font-mono text-[10px] font-semibold tracking-[0.12em]" style={{ color: ACCENT }}>YOUR WEBSITE</div><h3 className="mt-2 text-xl font-semibold">Place one embed</h3></div>
            <p className="max-w-[48ch] text-sm leading-relaxed" style={{ color: INK_2 }}>Add the widget to WordPress, Squarespace, Webflow, or custom HTML. It uses your services and pricing as soon as the embed loads.</p>
            <pre className="overflow-x-auto border-l-2 px-4 py-3 font-mono text-[12px] leading-relaxed" style={{ borderColor: ACCENT, background: SURFACE_2, color: INK_2 }} aria-label="Example embed code"><code>&lt;<span style={{ color: ACCENT }}>closet-quote-widget</span>{'\n'}  data-contractor-id=&quot;…&quot;{'\n'}/&gt;</code></pre>
          </div>
          <div className="grid gap-6 py-8 md:grid-cols-[210px_1fr_300px] md:items-center">
            <div><div className="font-mono text-[10px] font-semibold tracking-[0.12em]" style={{ color: ACCENT }}>DELIVERY</div><h3 className="mt-2 text-xl font-semibold">Receive the whole lead</h3></div>
            <p className="max-w-[48ch] text-sm leading-relaxed" style={{ color: INK_2 }}>Name, number, selected service, job size, options, and quoted total arrive by SMS, with an email copy for your records.</p>
            <div className="border-l-2 px-4 py-3 text-[12.5px]" style={{ borderColor: INK, background: SURFACE_2 }}><span className="font-semibold">Dana R.</span> · Walk-in, 96 sq ft<br />Soft-close + LED · $7,620<div className="mt-2 font-mono text-[10px]" style={{ color: INK_3 }}>EXAMPLE DELIVERY · SMS + EMAIL</div></div>
          </div>
        </div>
        <p className="mt-6 text-sm" style={{ color: INK_2 }}>The widget trial requires no card for 30 days. Every plan has zero per-lead fees.</p>
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
          <Link
            href="/signup/pro"
            className="inline-flex min-h-11 items-center justify-center px-6 py-3.5 text-sm font-semibold text-white transition hover:opacity-85"
            style={{ background: INK, color: '#FFFFFF', minHeight: 44 }}
          >
            Add quoting to my site
          </Link>
          <Link
            href="/get-started"
            className="inline-flex min-h-11 items-center justify-center border px-6 py-3.5 text-sm font-semibold transition hover:border-[#626B75]"
            style={{ borderColor: HAIRLINE_2, color: INK }}
          >
            Build my site with it
          </Link>
        </div>
      </section>
      </main>

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
                Rate-sheet quotes delivered by SMS and email from your own site.
              </p>
            </div>

            <div>
              <p
                className="mb-4 text-xs font-semibold"
                style={{ color: INK_2 }}
              >
                Product
              </p>
              <ul className="space-y-2.5">
                <li>
                  <a
                    href="#demo"
                    className="inline-flex min-h-11 items-center text-xs transition hover:opacity-70"
                    style={{ color: INK_3, minHeight: 44, display: 'inline-flex' }}
                  >
                    Live Demo
                  </a>
                </li>
                <li>
                  <a
                    href="#pricing"
                    className="inline-flex min-h-11 items-center text-xs transition hover:opacity-70"
                    style={{ color: INK_3, minHeight: 44, display: 'inline-flex' }}
                  >
                    Pricing
                  </a>
                </li>
                <li>
                  <a
                    href="#portfolio"
                    className="inline-flex min-h-11 items-center text-xs transition hover:opacity-70"
                    style={{ color: INK_3, minHeight: 44, display: 'inline-flex' }}
                  >
                    Portfolio
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <p
                className="mb-4 text-xs font-semibold"
                style={{ color: INK_2 }}
              >
                Company
              </p>
              <ul className="space-y-2.5">
                <li>
                  <a
                    href="mailto:support@ditchtheform.com"
                    className="inline-flex min-h-11 items-center text-xs transition hover:opacity-70"
                    style={{ color: INK_3, minHeight: 44, display: 'inline-flex' }}
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <p
                className="mb-4 text-xs font-semibold"
                style={{ color: INK_2 }}
              >
                Account
              </p>
              <ul className="space-y-2.5">
                {isLoggedIn ? (
                  <>
                    <li>
                      <Link
                        href="/dashboard"
                        className="inline-flex min-h-11 items-center text-xs transition hover:opacity-70"
                        style={{ color: INK_3, minHeight: 44, display: 'inline-flex' }}
                      >
                        Dashboard
                      </Link>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => void handleSignOut()}
                        disabled={signingOut}
                        className="inline-flex min-h-11 items-center text-xs transition hover:opacity-70 disabled:opacity-50"
                        style={{ color: INK_3, minHeight: 44, display: 'inline-flex' }}
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
                        className="inline-flex min-h-11 items-center text-xs transition hover:opacity-70"
                        style={{ color: INK_3, minHeight: 44, display: 'inline-flex' }}
                      >
                        Sign In
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/signup"
                        className="inline-flex min-h-11 items-center text-xs transition hover:opacity-70"
                        style={{ color: INK_3, minHeight: 44, display: 'inline-flex' }}
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
  'One-line embed for WordPress, Squarespace, Webflow, or custom HTML',
  'Unlimited SMS & email lead capture (no per-lead fees)',
  'Custom services, job types & pricing rules (per-unit, tiered, or distance)',
  'Dynamic add-on manager for upsells & extras',
  'Lead inbox, quote history & business dashboard',
  'Works alongside your current brand and domain',
]

const STANDARD_FEATURES = [
  'Custom marketing site + embedded quote calculator',
  'Up to 5 pages (Home plus 4 you choose during setup)',
  'Professional stock hero & service imagery',
  'Unlimited lead capture via SMS & email',
  'Custom service & option pricing',
  'After launch: hosting, SSL, Pro widget, and 1 content tweak/month',
]

const PREMIUM_FEATURES = [
  'Everything in Standard',
  'Up to 10 pages (Home plus 9 you choose during setup)',
  'Selling copy grounded in your services, process, and market',
  'Original hero and service imagery directed for your business',
  'Local competitor and pricing research for your metro',
  '2 revision rounds in the first 30 days after launch',
  'Up to 3 image rounds, with 3 options in each round',
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
        <Link
          href="/get-started"
          className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
          style={{ color: ACCENT }}
        >
          Start a site build
        </Link>{' '}
        to see the same options used at checkout. After launch, site maintenance is{' '}
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
            {formatUsd(standard.totalCents)}{' '}and we launch it. Full access to
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
            Custom Studio build
          </h4>
          <p className="text-sm leading-relaxed" style={{ color: INK_2 }}>
            The {formatUsd(premium.depositCents)} deposit (30%) covers the image
            studio during intake. We build with the shots you choose. You
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
      className="inline-flex items-center gap-1 border p-1"
      style={{ borderColor: HAIRLINE_2 }}
    >
      <button
        type="button"
        onClick={() => onBillingChange('monthly')}
        className="min-h-11 px-3.5 py-1.5 text-xs font-medium transition"
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
        className="flex min-h-11 items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium transition"
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
          Applies to the Pro subscription and site maintenance. Build fees are
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
          className="flex flex-col border bg-white p-7"
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
              className="flex min-h-11 w-full items-center justify-center border px-5 py-3 text-sm font-medium transition hover:border-[#626B75]"
              style={{ borderColor: HAIRLINE_2, color: INK }}
            >
              Start the free month
            </Link>
            <Link
              href={`/signup/pro?subscribe=1&plan=${billing}`}
              className="flex min-h-11 w-full items-center justify-center px-5 py-2 text-[13px] font-medium underline-offset-4 transition hover:underline"
              style={{ color: INK_2 }}
            >
              Subscribe now — skip trial
            </Link>
          </div>
        </div>

        {/* Standard site build */}
        <div
          className="flex flex-col border bg-white p-7"
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
            launch ({siteMaint.billedLabel}). Hosting, SSL, Pro widget, and 1
            content tweak/month included, no separate{' '}
            {formatUsd(widgetSub.monthlyCents)}/mo widget fee.
          </p>
          <PricingFeatureList features={STANDARD_FEATURES} />
          <div className="mt-auto flex flex-col gap-2">
            <Link
              href="/get-started?tier=standard"
              className="flex min-h-11 w-full items-center justify-center border px-5 py-3 text-sm font-medium transition hover:border-[#626B75]"
              style={{ borderColor: HAIRLINE_2, color: INK }}
            >
              Start a Standard build
            </Link>
            <p className="text-center text-[12px]" style={{ color: INK_3 }}>
              Nothing due until you approve the site
            </p>
          </div>
        </div>

        {/* Custom Studio — featured, inverted ink card */}
        <div
          className="flex flex-col border p-7"
          style={{ background: INK, color: BG, borderColor: INK }}
        >
          <p
            className="mb-3 text-xs font-medium"
            style={{ color: 'rgba(251,251,250,0.6)' }}
          >
            Site build · Recommended
          </p>
          <h3 className="text-lg font-semibold tracking-tight">
            Custom Studio
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
            launch ({siteMaint.billedLabel}). Same coverage as Standard, plus
            2 revision rounds in your first 30 days (included in the build).
          </p>
          <PricingFeatureList features={PREMIUM_FEATURES} inverted />
          <div className="mt-auto flex flex-col gap-2">
            <Link
              href="/get-started?tier=custom_studio"
              className="flex min-h-11 w-full items-center justify-center px-5 py-3 text-sm font-medium transition hover:opacity-90"
              style={{ background: BG, color: INK }}
            >
              Start a Custom Studio build
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
          Three working design studies
        </h3>
        <p
          className="mt-4 max-w-[60ch] text-[15px] leading-relaxed"
          style={{ color: INK_2 }}
        >
          Each is a working demo, not customer proof and not a template we copy.
          Open them, run a quote, and compare the range. Your site receives its
          own structure, typography, imagery, and conversion path.
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
              className="group block overflow-hidden border bg-white transition-transform duration-200 hover:-translate-y-1"
              style={{ borderColor: HAIRLINE, minHeight: 80, display: 'block' }}
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
