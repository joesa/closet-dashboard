'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabaseBrowser } from '@/lib/supabase-browser'

// ── Space types the wizard offers ─────────────────────────────────────────
const SPACE_TYPES = [
  { id: 'Walk-In Closet', icon: '👔', label: 'Walk-In Closets' },
  { id: 'Reach-In Closet', icon: '🚪', label: 'Reach-In Closets' },
  { id: 'Garage', icon: '🚗', label: 'Garages' },
  { id: 'Pantry & Wine', icon: '🍷', label: 'Pantry & Wine' },
  { id: 'Home Office', icon: '💼', label: 'Home Offices' },
  { id: 'Laundry Room', icon: '👕', label: 'Laundry Rooms' },
  { id: 'Mudroom', icon: '🥾', label: 'Mudrooms' },
  { id: 'Entertainment Center', icon: '📺', label: 'Entertainment Centers' },
  { id: 'Wall Beds', icon: '🛏', label: 'Wall Beds' },
  { id: 'Craft Room', icon: '✂️', label: 'Craft Rooms' },
  { id: 'Home Library', icon: '📚', label: 'Home Libraries' },
  { id: 'Kid Spaces', icon: '🧸', label: 'Kid Spaces' },
  { id: 'Dressing Room', icon: '🪞', label: 'Dressing Rooms' },
  { id: 'Home Storage', icon: '📦', label: 'Home Storage' },
]

type Step = 1 | 2 | 3 | 4 | 5

interface FormState {
  // Step 1 — basics
  businessName: string
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
  // Step 5 — account
  password: string
}

const INITIAL: FormState = {
  businessName: '', email: '', phone: '', brandColor: '#6C47FF',
  services: [], otherServices: '',
  pricingModel: 'linear_ft',
  tierNameBasic: 'Basic', tierNameStandard: 'Standard', tierNamePremium: 'Premium',
  seedBasic: '', seedStandard: '', seedPremium: '',
  hasFinishes: false,
  finish1Label: '', finish1Color: '#C8A97E',
  finish2Label: '', finish2Color: '#8B6F47',
  finish3Label: '', finish3Color: '#3D2B1F',
  addOnText: '',
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
function Step1({ form, set }: { form: FormState; set: (k: keyof FormState, v: string) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Business Name
        </label>
        <input
          className={INPUT}
          placeholder="e.g. Meridian Custom Closets"
          value={form.businessName}
          onChange={(e) => set('businessName', e.target.value)}
        />
      </div>
      <div>
        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Your Email
        </label>
        <input
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
          We'll text you instantly when a homeowner submits the calculator.
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

// ── Step 2 — Service Model ─────────────────────────────────────────────────
function Step2({
  form,
  toggle,
  set,
}: {
  form: FormState
  toggle: (id: string) => void
  set: (k: keyof FormState, v: string) => void
}) {
  return (
    <div>
      <p className="mb-5 text-sm text-zinc-400">
        Select every space type you work in. We'll hide the rest from your calculator so
        homeowners only see what you actually offer.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {SPACE_TYPES.map((s) => {
          const active = form.services.includes(s.id)
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => toggle(s.id)}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-all ${
                active
                  ? 'border-white/30 bg-white/10 text-white'
                  : 'border-white/[0.06] bg-white/[0.02] text-zinc-500 hover:border-white/15 hover:text-zinc-300'
              }`}
            >
              <span className="text-base leading-none">{s.icon}</span>
              <span className="text-[12px] leading-snug">{s.label}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-5">
        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Other Spaces <span className="text-zinc-600 normal-case font-normal">(not listed above)</span>
        </label>
        <input
          className={INPUT}
          placeholder="e.g. Safe rooms, Wine cellars, Custom built-ins…"
          value={form.otherServices}
          onChange={(e) => set('otherServices', e.target.value)}
        />
      </div>
    </div>
  )
}

// ── Step 3 — Pricing Philosophy ────────────────────────────────────────────
function Step3({ form, set }: { form: FormState; set: (k: keyof FormState, v: string) => void }) {
  return (
    <div className="space-y-7">
      {/* Pricing model */}
      <div>
        <label className="mb-3 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          How do you price your work?
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            {
              id: 'linear_ft',
              label: 'Per Linear Foot',
              sub: 'Industry standard — price scales with footage',
            },
            {
              id: 'fixed',
              label: 'Fixed Per Room',
              sub: 'Flat project price regardless of size',
            },
          ].map((opt) => {
            const active = form.pricingModel === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => set('pricingModel', opt.id)}
                className={`rounded-xl border p-4 text-left transition-all ${
                  active
                    ? 'border-white/30 bg-white/[0.07]'
                    : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15'
                }`}
              >
                <p className="text-sm font-semibold text-white">{opt.label}</p>
                <p className="mt-1 text-[12px] text-zinc-500">{opt.sub}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tier names */}
      <div>
        <label className="mb-3 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          What do you call your tiers?
        </label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: 'tierNameBasic' as const, placeholder: 'Basic' },
            { key: 'tierNameStandard' as const, placeholder: 'Standard' },
            { key: 'tierNamePremium' as const, placeholder: 'Premium' },
          ].map((t) => (
            <input
              key={t.key}
              className={INPUT}
              placeholder={t.placeholder}
              value={form[t.key]}
              onChange={(e) => set(t.key, e.target.value)}
            />
          ))}
        </div>
      </div>

      {/* Seed pricing */}
      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Approximate pricing per tier{' '}
          <span className="text-zinc-600 normal-case font-normal">
            ({form.pricingModel === 'linear_ft' ? '$/lin ft — optional' : '$/room — optional'})
          </span>
        </label>
        <p className="mb-3 text-[12px] text-zinc-600">
          Leave blank and our AI will use industry-standard estimates. You can always fine-tune from your dashboard.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: 'seedBasic' as const, label: form.tierNameBasic || 'Basic' },
            { key: 'seedStandard' as const, label: form.tierNameStandard || 'Standard' },
            { key: 'seedPremium' as const, label: form.tierNamePremium || 'Premium' },
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

// ── Step 4 — Finishes & Add-Ons ────────────────────────────────────────────
function Step4({ form, set, setBool }: {
  form: FormState
  set: (k: keyof FormState, v: string) => void
  setBool: (k: keyof FormState, v: boolean) => void
}) {
  return (
    <div className="space-y-7">
      {/* Finishes toggle */}
      <div>
        <label className="mb-3 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Do you carry different material finishes?
        </label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { v: true, label: 'Yes — I offer multiple finishes' },
            { v: false, label: 'No — standard materials only' },
          ].map((opt) => (
            <button
              key={String(opt.v)}
              type="button"
              onClick={() => setBool('hasFinishes', opt.v)}
              className={`rounded-xl border p-4 text-left text-sm font-medium transition-all ${
                form.hasFinishes === opt.v
                  ? 'border-white/30 bg-white/[0.07] text-white'
                  : 'border-white/[0.06] bg-white/[0.02] text-zinc-500 hover:border-white/15'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {form.hasFinishes && (
          <div className="mt-4 space-y-3">
            <p className="text-[12px] text-zinc-500">
              Name up to 3 finishes. Pick a swatch color for each.
            </p>
            {[
              { labelKey: 'finish1Label' as const, colorKey: 'finish1Color' as const },
              { labelKey: 'finish2Label' as const, colorKey: 'finish2Color' as const },
              { labelKey: 'finish3Label' as const, colorKey: 'finish3Color' as const },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <input
                  type="color"
                  value={form[f.colorKey]}
                  onChange={(e) => set(f.colorKey, e.target.value)}
                  className="h-10 w-12 cursor-pointer rounded-lg border border-white/[0.08] bg-transparent p-1 flex-shrink-0"
                />
                <input
                  className={INPUT}
                  placeholder={`Finish ${i + 1} name (e.g. Espresso, White Oak, Midnight)`}
                  value={form[f.labelKey]}
                  onChange={(e) => set(f.labelKey, e.target.value)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add-ons */}
      <div>
        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Add-Ons You Offer <span className="text-zinc-600 normal-case font-normal">(optional)</span>
        </label>
        <textarea
          rows={3}
          className={`${INPUT} resize-none`}
          placeholder="e.g. LED lighting, pull-out drawers, velvet jewelry trays, shoe racks, island with seating…"
          value={form.addOnText}
          onChange={(e) => set('addOnText', e.target.value)}
        />
        <p className="mt-2 text-[11px] text-zinc-600">
          Separate by commas. Our AI will create add-on cards in your calculator and assign reasonable default prices.
        </p>
      </div>
    </div>
  )
}

// ── Step 5 — Review & Launch ───────────────────────────────────────────────
function Step5({
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
  const services = form.services.length > 0 ? form.services.join(', ') : 'Custom spaces'
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
          { label: 'Spaces', value: services },
          { label: 'Pricing', value: form.pricingModel === 'linear_ft' ? 'Per linear foot' : 'Fixed per room' },
          { label: 'Tiers', value: `${form.tierNameBasic || 'Basic'} / ${form.tierNameStandard || 'Standard'} / ${form.tierNamePremium || 'Premium'}` },
          { label: 'Finishes', value: finishes },
          { label: 'Add-Ons', value: form.addOnText || 'None' },
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
export default function ProSignupPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const subscribePlan = searchParams.get('plan')

  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<FormState>(INITIAL)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Pre-fill email from query string if coming from a link
  useEffect(() => {
    const emailParam = searchParams.get('email')
    if (emailParam) setForm((f) => ({ ...f, email: emailParam }))
  }, [searchParams])

  const set = (k: keyof FormState, v: string) =>
    setForm((f) => ({ ...f, [k]: v }))

  const setBool = (k: keyof FormState, v: boolean) =>
    setForm((f) => ({ ...f, [k]: v }))

  const toggleService = (id: string) =>
    setForm((f) => ({
      ...f,
      services: f.services.includes(id)
        ? f.services.filter((s) => s !== id)
        : [...f.services, id],
    }))

  const canAdvance = (): boolean => {
    if (step === 1) return form.businessName.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
    if (step === 5) return form.password.length >= 8
    return true
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
      const finishLabels = [
        form.finish1Label && { label: form.finish1Label, swatchHex: form.finish1Color },
        form.finish2Label && { label: form.finish2Label, swatchHex: form.finish2Color },
        form.finish3Label && { label: form.finish3Label, swatchHex: form.finish3Color },
      ].filter(Boolean)

      const widgetConfigHints = {
        services: form.services,
        otherServices: form.otherServices || undefined,
        pricingModel: form.pricingModel,
        tierNames: {
          basic: form.tierNameBasic || 'Basic',
          standard: form.tierNameStandard || 'Standard',
          premium: form.tierNamePremium || 'Premium',
        },
        seedPricing: {
          basic: form.seedBasic ? parseFloat(form.seedBasic) : undefined,
          standard: form.seedStandard ? parseFloat(form.seedStandard) : undefined,
          premium: form.seedPremium ? parseFloat(form.seedPremium) : undefined,
        },
        hasFinishes: form.hasFinishes,
        finishLabels: finishLabels.length > 0 ? finishLabels : undefined,
        addOnText: form.addOnText || undefined,
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
    2: 'What Spaces Do You Work In?',
    3: 'How Do You Price Your Work?',
    4: 'Finishes & Add-Ons',
    5: 'Review & Launch',
  }

  const STEP_SUBTITLES: Record<Step, string> = {
    1: 'Let\'s get the basics down.',
    2: 'Your calculator will only show the spaces you actually offer.',
    3: 'We\'ll pre-configure your pricing so homeowners see real estimates.',
    4: 'These become upsell cards inside your calculator.',
    5: 'Your AI-configured calculator is ready to build.',
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="text-sm font-bold tracking-tight">
            Closet<span className="text-slate-400">Quote</span>
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
            Step {step} of 5
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {STEP_TITLES[step]}
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500">{STEP_SUBTITLES[step]}</p>
        </div>

        {/* Step content */}
        <div className="mb-8">
          {step === 1 && <Step1 form={form} set={set} />}
          {step === 2 && <Step2 form={form} toggle={toggleService} set={set} />}
          {step === 3 && <Step3 form={form} set={set} />}
          {step === 4 && <Step4 form={form} set={set} setBool={setBool} />}
          {step === 5 && (
            <Step5
              form={form}
              set={set}
              submitting={submitting}
              error={error}
              onSubmit={handleSubmit}
            />
          )}
        </div>

        {/* Navigation */}
        {step < 5 && (
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
              disabled={!canAdvance()}
              onClick={() => setStep((s) => (s + 1) as Step)}
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
