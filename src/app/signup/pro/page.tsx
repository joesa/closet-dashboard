'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { inferQuoteCalculatorGuidance } from '@/lib/quoteCalculatorGuidance'

type Step = 1 | 2 | 3 | 4

interface FormState {
  // Step 1 — basics
  businessName: string
  industry: string
  email: string
  phone: string
  brandColor: string
  // Step 2 — services
  services: string[]
  otherServices: string
  // Step 3 — pricing
  pricingModel: 'linear_ft' | 'fixed'
  tierNameBasic: string
  tierNameStandard: string
  tierNamePremium: string
  seedBasic: string
  seedStandard: string
  seedPremium: string
  // Step 4 — finishes & add-ons
  hasFinishes: boolean
  finish1Label: string; finish1Color: string
  finish2Label: string; finish2Color: string
  finish3Label: string; finish3Color: string
  addOnText: string
  calculatorNotes: string
  // Step 5 — account
  password: string
}

const INITIAL: FormState = {
  businessName: '', industry: '', email: '', phone: '', brandColor: '#6C47FF',
  services: [], otherServices: '',
  pricingModel: 'linear_ft',
  tierNameBasic: 'Basic', tierNameStandard: 'Standard', tierNamePremium: 'Premium',
  seedBasic: '', seedStandard: '', seedPremium: '',
  hasFinishes: false,
  finish1Label: '', finish1Color: '#C8A97E',
  finish2Label: '', finish2Color: '#8B6F47',
  finish3Label: '', finish3Color: '#3D2B1F',
  addOnText: '',
  calculatorNotes: '',
  password: '',
}

// ── Shared input style ─────────────────────────────────────────────────────
const INPUT =
  'w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-white/30 focus:bg-white/[0.07]'

// ── Step indicator ─────────────────────────────────────────────────────────
function StepDots({ current }: { current: Step }) {
  return (
    <div className="flex items-center gap-2 mb-10">
      {([1, 2, 3, 4, 5] as Step[]).map((s) => (
        <div
          key={s}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            s === current ? 'w-8 bg-white' : s < current ? 'w-4 bg-white/40' : 'w-4 bg-white/10'
          }`}
        />
      ))}
    </div>
  )
}

// ── Step 1 — Business Basics ───────────────────────────────────────────────
function Step1({
  form,
  set,
  businessNameRef,
  emailRef,
}: {
  form: FormState
  set: (k: keyof FormState, v: string) => void
  businessNameRef: React.RefObject<HTMLInputElement | null>
  emailRef: React.RefObject<HTMLInputElement | null>
}) {
  return (
    <div className="space-y-5">
      <div>
        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Business Name
        </label>
        <input
          ref={businessNameRef}
          className={INPUT}
          placeholder="e.g. Apex Plumbing Co."
          value={form.businessName}
          onChange={(e) => set('businessName', e.target.value)}
        />
      </div>
      <div>
        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Industry / Trade
        </label>
        <input
          className={INPUT}
          placeholder="e.g. Custom Closets, Plumbing, Towing, Landscaping"
          value={form.industry}
          onChange={(e) => set('industry', e.target.value)}
        />
        <p className="mt-2 text-[11px] text-zinc-600">
          We tailor your calculator and copy to your trade. Leave blank for custom storage / closets.
        </p>
      </div>
      <div>
        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Your Email
        </label>
        <input
          ref={emailRef}
          className={INPUT}
          type="email"
          placeholder="you@yourbusiness.com"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
        />
      </div>
      <div>
        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Lead Alert Phone <span className="text-zinc-600 normal-case font-normal">(optional)</span>
        </label>
        <input
          className={INPUT}
          type="tel"
          placeholder="+1 555 123 4567"
          value={form.phone}
          onChange={(e) => set('phone', e.target.value)}
        />
        <p className="mt-2 text-[11px] text-zinc-600">
          We'll text you instantly when a customer submits the calculator.
        </p>
      </div>
      <div>
        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Brand Color
        </label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={form.brandColor}
            onChange={(e) => set('brandColor', e.target.value)}
            className="h-11 w-14 cursor-pointer rounded-lg border border-white/[0.08] bg-transparent p-1"
          />
          <input
            className={`${INPUT} font-mono`}
            value={form.brandColor}
            onChange={(e) => set('brandColor', e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}

// ── Step 2 — Services Offered ──────────────────────────────────────────────
function Step2({
  form,
  set,
  guidance,
}: {
  form: FormState
  set: (k: keyof FormState, v: string) => void
  guidance: ReturnType<typeof inferQuoteCalculatorGuidance>
}) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-zinc-400">
        List the services or jobs you quote — whatever your trade. Separate each
        one with a comma. Your calculator and AI copy are built around exactly
        what you offer.
      </p>
      <div>
        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Services / Jobs You Offer
        </label>
        <textarea
          rows={4}
          className={`${INPUT} resize-none`}
          placeholder="e.g. Drain cleaning, Water heater install, Leak repair — or Light towing, Winch-out, Jump start — or Walk-in closets, Garages, Pantries…"
          value={form.otherServices}
          onChange={(e) => set('otherServices', e.target.value)}
        />
        <p className="mt-2 text-[11px] text-zinc-600">
          Don&apos;t overthink it — you can fine-tune every service, price, and label from your dashboard later.
        </p>
      </div>
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Examples for {guidance.tradeLabel}</p>
        <p className="mt-2 text-sm text-zinc-300">Good service lists are specific enough that each item could become its own quote option.</p>
        <p className="mt-2 text-sm text-zinc-400">Try something like: {guidance.serviceExamples.join(', ')}</p>
      </div>
    </div>
  )
}

// ── Step 3 — Pricing Philosophy ────────────────────────────────────────────
function Step3({
  form,
  set,
  guidance,
}: {
  form: FormState
  set: (k: keyof FormState, v: string) => void
  guidance: ReturnType<typeof inferQuoteCalculatorGuidance>
}) {
  return (
    <div className="space-y-7">
      {/* Seed pricing */}
      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Provide 1-2 starting prices so our AI can configure your calculator
        </label>
        <p className="mb-3 text-[12px] text-zinc-600">
          Leave blank and our AI will use industry-standard estimates. You can always fine-tune from your dashboard.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: 'seedBasic' as const, label: 'Seed 1' },
            { key: 'seedStandard' as const, label: 'Seed 2' },
            { key: 'seedPremium' as const, label: 'Seed 3' },
          ].map((t) => (
            <div key={t.key}>
              <p className="mb-1.5 text-[11px] text-zinc-500">{t.label}</p>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-600">$</span>
                <input
                  type="number"
                  min="0"
                  className={`${INPUT} pl-7`}
                  placeholder="—"
                  value={form[t.key]}
                  onChange={(e) => set(t.key, e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
// ── Step 4 — Review & Launch ───────────────────────────────────────────────
function Step4({
  form,
  set,
  submitting,
  error,
  onSubmit,
}: {
  form: FormState
  set: (k: keyof FormState, v: string) => void
  submitting: boolean
  error: string
  onSubmit: () => void
}) {
  const serviceList = form.otherServices
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const services = serviceList.length > 0 ? serviceList.join(', ') : 'Your services'
  const finishes = form.hasFinishes
    ? [form.finish1Label, form.finish2Label, form.finish3Label].filter(Boolean).join(', ')
    : 'Standard'

  return (
    <div className="space-y-6">
      {/* Summary card */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] divide-y divide-white/[0.05]">
        {[
          { label: 'Business', value: form.businessName || '—' },
          { label: 'Email', value: form.email || '—' },
          { label: 'Phone', value: form.phone || 'Not set' },
          { label: 'Services', value: services },
          { label: 'Pricing', value: form.pricingModel === 'linear_ft' ? 'Per unit / size' : 'Flat per job' },
          { label: 'Tiers', value: `${form.tierNameBasic || 'Basic'} / ${form.tierNameStandard || 'Standard'} / ${form.tierNamePremium || 'Premium'}` },
          { label: 'Finishes', value: finishes },
          { label: 'Add-Ons', value: form.addOnText || 'None' },
          { label: 'Quote logic', value: form.calculatorNotes || 'AI will infer from the rest of your answers' },
        ].map((row) => (
          <div key={row.label} className="flex items-baseline gap-4 px-5 py-3">
            <span className="w-20 flex-shrink-0 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
              {row.label}
            </span>
            <span className="text-sm text-zinc-300 leading-snug">{row.value}</span>
          </div>
        ))}
      </div>

      {/* Password */}
      <div>
        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Create a Password
        </label>
        <input
          className={INPUT}
          type="password"
          placeholder="At least 8 characters"
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
          autoComplete="new-password"
        />
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting}
        className="w-full rounded-xl bg-white py-3.5 text-sm font-semibold text-black transition hover:bg-slate-100 active:scale-[0.98] disabled:opacity-50"
      >
        {submitting ? 'Setting up your calculator…' : 'Launch My Calculator →'}
      </button>

      <p className="text-center text-[11px] text-zinc-600">
        30-day free trial · No credit card required · Cancel anytime
      </p>
    </div>
  )
}

function isAlreadyRegisteredError(message: string): boolean {
  return /already registered/i.test(message)
}

/** Create a new auth account, or sign in when the email is already registered. */
async function ensureProAccount(
  email: string,
  password: string,
  businessName: string
): Promise<void> {
  const { data: authData, error: authErr } = await supabaseBrowser.auth.signUp({
    email,
    password,
    options: { data: { company_name: businessName } },
  })

  if (!authErr && authData.user) return

  if (authErr && isAlreadyRegisteredError(authErr.message)) {
    const { error: signInErr } = await supabaseBrowser.auth.signInWithPassword({
      email,
      password,
    })
    if (signInErr) {
      throw new Error(
        'This email is already registered. Enter your account password to continue, or sign in first.'
      )
    }
    return
  }

  if (authErr) throw new Error(authErr.message)
  throw new Error('Signup failed — please try again.')
}

// ── Main wizard ────────────────────────────────────────────────────────────
function ProSignupWizard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const subscribePlan = searchParams.get('plan')

  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<FormState>(INITIAL)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const businessNameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const guidance = inferQuoteCalculatorGuidance({
    industry: form.industry,
    servicesText: form.otherServices,
  })

  // Pre-fill email from query string if coming from a link
  useEffect(() => {
    const emailParam = searchParams.get('email')
    if (emailParam) setForm((f) => ({ ...f, email: emailParam }))
  }, [searchParams])

  const set = (k: keyof FormState, v: string) =>
    setForm((f) => ({ ...f, [k]: v }))

  const setBool = (k: keyof FormState, v: boolean) =>
    setForm((f) => ({ ...f, [k]: v }))

  const readStep1Values = () => {
    const businessName = (businessNameRef.current?.value ?? form.businessName).trim()
    const email = (emailRef.current?.value ?? form.email).trim()
    return { businessName, email }
  }

  const canAdvanceFromStep1 = () => {
    const { businessName, email } = readStep1Values()
    return businessName.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const canAdvance = (): boolean => {
    if (step === 1) return canAdvanceFromStep1()
    if (step === 4) return form.password.length >= 8
    return true
  }

  const goNextStep = () => {
    if (step === 1) {
      const { businessName, email } = readStep1Values()
      if (!canAdvanceFromStep1()) return
      if (businessName !== form.businessName || email !== form.email) {
        setForm((f) => ({ ...f, businessName, email }))
      }
      setStep(2)
      return
    }
    setStep((s) => (s + 1) as Step)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')

    try {
      // 1. Create auth account (or sign in if email already registered)
      await ensureProAccount(form.email, form.password, form.businessName)

      const bootstrap = await fetch('/api/contractor/bootstrap', { method: 'POST' })
      if (!bootstrap.ok) {
        const json = (await bootstrap.json().catch(() => ({}))) as { error?: string }
        throw new Error(json.error || 'Could not set up your account. Please try again.')
      }

      // 2. Build widget_config_hints payload
      const serviceList = form.otherServices
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      const widgetConfigHints = {
        industry: form.industry?.trim() || undefined,
        services: serviceList,
        otherServices: undefined,
        seedPricing: {
          basic: form.seedBasic ? parseFloat(form.seedBasic) : undefined,
          standard: form.seedStandard ? parseFloat(form.seedStandard) : undefined,
          premium: form.seedPremium ? parseFloat(form.seedPremium) : undefined,
        },
        brandColor: form.brandColor,
        businessName: form.businessName,
      }

      // 3. Create the intake record with Pro widget hints
      const origin = window.location.origin
      const res = await fetch('/api/intake/pro/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          businessName: form.businessName,
          phone: form.phone,
          brandColor: form.brandColor,
          widgetConfigHints,
          subscribePlan,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Setup failed')

      // 4. Redirect to dashboard
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  const STEP_TITLES: Record<Step, string> = {
    1: 'Your Business',
    2: 'What Services Do You Offer?',
    3: 'Seed Pricing',
    4: 'Review & Launch',
  }

  const STEP_SUBTITLES: Record<Step, string> = {
    1: 'Let\'s get the basics down.',
    2: 'Your calculator only shows the services you actually offer.',
    3: 'We\'ll pre-configure your pricing so customers see real estimates.',
    4: 'Your AI-configured calculator is ready to build.',
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="text-sm font-bold tracking-tight">
            Ditch<span className="text-slate-400">TheForm</span>
          </Link>
          <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-medium text-zinc-500">
            Pro Calculator Setup
          </span>
        </div>
      </nav>

      <main className="mx-auto max-w-lg px-6 pt-32 pb-24">
        {/* Header */}
        <div className="mb-8">
          <StepDots current={step} />
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-zinc-600">
            Step {step} of 4
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {STEP_TITLES[step]}
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500">{STEP_SUBTITLES[step]}</p>
        </div>

        {/* Step content */}
        <div className="mb-8">
          {step === 1 && (
            <Step1
              form={form}
              set={set}
              businessNameRef={businessNameRef}
              emailRef={emailRef}
            />
          )}
          {step === 2 && <Step2 form={form} set={set} guidance={guidance} />}
          {step === 3 && <Step3 form={form} set={set} guidance={guidance} />}
          {step === 4 && (
            <Step4
              form={form}
              set={set}
              submitting={submitting}
              error={error}
              onSubmit={handleSubmit}
            />
          )}
        </div>

        {/* Navigation */}
        {step < 4 && (
          <div className="flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as Step)}
                className="text-sm text-zinc-500 transition hover:text-white"
              >
                ← Back
              </button>
            ) : (
              <Link href="/signup" className="text-sm text-zinc-500 transition hover:text-white">
                ← Use simple signup
              </Link>
            )}
            <button
              type="button"
              disabled={step !== 1 && !canAdvance()}
              onClick={goNextStep}
              className="rounded-xl bg-white px-6 py-2.5 text-sm font-semibold text-black transition hover:bg-slate-100 active:scale-[0.98] disabled:opacity-30"
            >
              Continue →
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

export default function ProSignupPage() {
  return (
    <Suspense fallback={null}>
      <ProSignupWizard />
    </Suspense>
  )
}
