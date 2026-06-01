'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { provisionServiceLabelsFromForm } from '@/lib/intake/provisionServiceLabels';
import type { IntakeTierCatalogEntry } from '@/lib/intake/tiers';
import type { IntakeCheckoutKind } from '@/lib/intake/intakePaymentStage';
import { startIntakeCheckout } from '@/lib/intake/startIntakeCheckout';
import {
  imageSelectionsComplete,
  type IntakeImageSelections,
} from '@/lib/intake/imageSelections';
import TierPicker from './TierPicker';
import DepositCTA from './DepositCTA';
import PayToLaunchBlock from './PayToLaunchBlock';
import IntakeImageStudio from './IntakeImageStudio';
import {
  OTHER_SERVICE_LABEL,
  SERVICE_GROUPS_ORDER,
  servicesByGroup,
} from '@/lib/catalog/contractorServices';

const SERVICE_GROUPS = servicesByGroup();
const VIBE_OPTIONS = [
  'Luxury & minimal', 'Bold & industrial', 'Warm & classic', 'Modern & clean',
  'Playful & friendly', 'Rustic & natural', 'Elegant & refined', 'Sleek & high-tech',
];
const TONE_OPTIONS = ['Professional & trustworthy', 'Friendly & approachable', 'Bold & confident', 'Elegant & refined'];
const CUSTOMER_OPTIONS = ['Luxury homeowners', 'Busy families', 'Budget-conscious homeowners', 'Builders & commercial clients', 'A mix of everyone'];
const EXPERIENCE_OPTIONS = ['Just getting started', '1–5 years', '5–15 years', '15+ years / well established'];
const DIFFERENTIATOR_OPTIONS = ['Lifetime warranty', 'Free in-home consultation', 'Made in USA', 'Family-owned', 'Award-winning', 'Eco-friendly materials', 'Fast turnaround', 'Financing available'];
const CTA_OPTIONS = ['Book a free consultation', 'Request a quote', 'Call now', 'Browse the portfolio'];

type Form = {
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  streetAddress: string;
  addressLocality: string;
  addressRegion: string;
  postalCode: string;
  serviceArea: string;
  notificationEmail: string;
  notificationPhone: string;
  services: string[];
  otherServices: string;
  pricingNotes: string;
  primaryColorHex: string;
  vibe: string;
  tone: string;
  customers: string;
  experience: string;
  differentiators: string[];
  primaryCta: string;
  desiredDomain: string;
  notes: string;
};

const label = 'block text-sm font-medium text-gray-700 mb-1';
const input = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none';

export type IntakeFormClientProps = {
  token: string;
  notFound?: boolean;
  businessName?: string;
  alreadySubmitted?: boolean;
  needsEmailVerify?: boolean;
  manualBuildOnSubmit?: boolean;
  intakeTier?: string;
  depositStatus?: string;
  depositRequiredCents?: number;
  tierTotalCents?: number;
  canUseImageStudio?: boolean;
  tierCatalog?: IntakeTierCatalogEntry[];
  aiSiteConfig?: Record<string, unknown> | null;
  imageSelections?: IntakeImageSelections;
  initialTierFromQuery?: string;
  payKindFromQuery?: IntakeCheckoutKind;
  paymentDueLabel?: string;
  paymentCheckoutKind?: IntakeCheckoutKind | null;
  canPayToLaunch?: boolean;
  paymentAmountCents?: number;
};

function emptyForm(businessName: string): Form {
  return {
    businessName,
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    streetAddress: '',
    addressLocality: '',
    addressRegion: '',
    postalCode: '',
    serviceArea: '',
    notificationEmail: '',
    notificationPhone: '',
    services: [],
    otherServices: '',
    pricingNotes: '',
    primaryColorHex: '#6C47FF',
    vibe: '',
    tone: '',
    customers: '',
    experience: '',
    differentiators: [],
    primaryCta: '',
    desiredDomain: '',
    notes: '',
  };
}

export default function IntakeFormClient({
  token,
  notFound = false,
  businessName = '',
  alreadySubmitted = false,
  needsEmailVerify = false,
  manualBuildOnSubmit = false,
  intakeTier: initialTier = 'standard',
  depositStatus: initialDepositStatus = 'not_required',
  depositRequiredCents = 0,
  tierTotalCents = 0,
  canUseImageStudio: initialCanStudio = false,
  tierCatalog = [],
  aiSiteConfig: initialAiSite = null,
  imageSelections: initialSelections,
  initialTierFromQuery,
  payKindFromQuery,
  paymentDueLabel = '',
  paymentCheckoutKind = null,
  canPayToLaunch = false,
  paymentAmountCents = 0,
}: IntakeFormClientProps) {
  const tierPreselectDone = useRef(false);
  const payAutoDone = useRef(false);
  const [form, setForm] = useState<Form>(() => emptyForm(businessName));
  const [logoDataUrl, setLogoDataUrl] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(alreadySubmitted);
  const [error, setError] = useState('');
  const [manualBuild, setManualBuild] = useState(
    alreadySubmitted ? manualBuildOnSubmit : false
  );
  const [intakeTier, setIntakeTier] = useState(initialTier);
  const [depositStatus, setDepositStatus] = useState(initialDepositStatus);
  const [canUseImageStudio, setCanUseImageStudio] = useState(initialCanStudio);
  const [aiSiteConfig, setAiSiteConfig] = useState(initialAiSite);
  const [imageSelections, setImageSelections] = useState(
    initialSelections ?? { hero: { attemptsUsed: 0, history: [] }, products: [] }
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') !== 'success') return;
    fetch(`/api/intake/${token}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.depositStatus) setDepositStatus(json.depositStatus);
        if (json.canUseImageStudio) setCanUseImageStudio(true);
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (tierPreselectDone.current || !initialTierFromQuery || submitted) return;
    if (initialTierFromQuery === intakeTier) return;
    tierPreselectDone.current = true;
    fetch(`/api/intake/${token}/tier`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: initialTierFromQuery }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.tier) {
          setIntakeTier(json.tier);
          setDepositStatus(json.depositStatus);
          setCanUseImageStudio(!!json.canUseImageStudio);
        }
      })
      .catch(() => {});
  }, [initialTierFromQuery, intakeTier, submitted, token]);

  useEffect(() => {
    if (payAutoDone.current || !payKindFromQuery || !canPayToLaunch) return;
    payAutoDone.current = true;
    void startIntakeCheckout(token, payKindFromQuery);
  }, [payKindFromQuery, canPayToLaunch, token]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const toggle = (key: 'services' | 'differentiators', value: string) =>
    setForm((f) => {
      const list = f[key];
      return { ...f, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] };
    });

  const onLogo = (file: File | null) => {
    if (!file) { setLogoDataUrl(''); return; }
    if (file.size > 3 * 1024 * 1024) { setError('Logo must be under 3MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsDataURL(file);
  };

  /** Use button onClick + fetch — not form submit (sandboxed iframes block allow-forms). */
  const studioServices = useMemo(
    () => provisionServiceLabelsFromForm(form.services, form.otherServices),
    [form.services, form.otherServices]
  );

  const premiumImagesReady =
    intakeTier !== 'ai_premium' ||
    imageSelectionsComplete(imageSelections, studioServices);

  const submitForm = async () => {
    if (intakeTier === 'ai_premium' && depositRequiredCents > 0 && depositStatus !== 'paid') {
      setError('Pay the 30% deposit before submitting.');
      return;
    }
    if (intakeTier === 'ai_premium' && !premiumImagesReady) {
      setError('Select hero and product images in the AI studio before submitting.');
      return;
    }
    const hasOther = form.services.includes(OTHER_SERVICE_LABEL);
    if (hasOther) {
      const t = form.otherServices.trim();
      if (t.length < 1 || t.length > 120) {
        setError('Describe your other service (1–120 characters).');
        return;
      }
    }
    if (
      form.services.filter((s) => s !== OTHER_SERVICE_LABEL).length === 0 &&
      !hasOther
    ) {
      setError('Select at least one service you offer.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/intake/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          otherServices: form.otherServices.trim() || undefined,
          logoDataUrl: logoDataUrl || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to submit');
      setManualBuild(!!json.manualBuild);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  if (notFound) {
    return (
      <div className="min-h-screen grid place-items-center bg-gray-50 px-6 text-center">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Link not found</h1>
          <p className="mt-2 text-sm text-gray-500">This intake link is invalid or has expired. Please ask your contact for a new one.</p>
        </div>
      </div>
    );
  }
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 py-10 px-4">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-green-100 text-green-600">✓</div>
          <h1 className="text-xl font-semibold text-gray-900">Thank you!</h1>
          <p className="mt-2 text-sm text-gray-600">
            {manualBuild
              ? 'Your details have been received. Our team will build your custom site and quote calculator and email you when it is ready.'
              : 'Your details have been received. We are building your site and quote calculator in the background. Check your email for login credentials when provisioning completes.'}
          </p>
          <div className="mt-8 text-left">
            <PayToLaunchBlock
              token={token}
              paymentDueLabel={paymentDueLabel}
              checkoutKind={paymentCheckoutKind}
              canPay={canPayToLaunch}
              amountCents={paymentAmountCents}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="mx-auto max-w-2xl">
        {tierCatalog.length > 0 && (
          <div className="mb-8">
            <TierPicker
              token={token}
              catalog={tierCatalog}
              currentTier={intakeTier}
              depositStatus={depositStatus}
              onTierChange={(tier, dep, studio) => {
                setIntakeTier(tier);
                setDepositStatus(dep);
                setCanUseImageStudio(studio);
              }}
            />
          </div>
        )}

        {intakeTier === 'ai_premium' && depositRequiredCents > 0 && (
          <div className="mb-8">
            <DepositCTA
              token={token}
              depositRequiredCents={depositRequiredCents}
              depositStatus={depositStatus}
              totalCents={tierTotalCents}
            />
          </div>
        )}

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Tell us about your business</h1>
          <p className="mt-1 text-sm text-gray-500">A few details so we can build your custom website and quote calculator. The more you share, the better the result.</p>
          {needsEmailVerify && (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Please verify your email using the link we sent before submitting this form.
              {' '}
              <a
                href={`/api/intake/public/verify?token=${encodeURIComponent(token)}`}
                className="font-medium underline"
              >
                Verify now
              </a>
            </p>
          )}
        </div>

        <div
          className="space-y-8"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
              e.preventDefault();
            }
          }}
        >
          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-4">Business &amp; contact</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className={label}>Business name *</label>
                <input className={input} required value={form.businessName} onChange={(e) => set('businessName', e.target.value)} />
              </div>
              <div>
                <label className={label}>Your name</label>
                <input className={input} value={form.contactName} onChange={(e) => set('contactName', e.target.value)} />
              </div>
              <div>
                <label className={label}>Business phone *</label>
                <input className={input} required value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} placeholder="(615) 555-0123" />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Business email *</label>
                <input className={input} type="email" required value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Street address</label>
                <input className={input} value={form.streetAddress} onChange={(e) => set('streetAddress', e.target.value)} placeholder="123 Main St" />
              </div>
              <div>
                <label className={label}>City</label>
                <input className={input} value={form.addressLocality} onChange={(e) => set('addressLocality', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={label}>State</label>
                  <input className={input} value={form.addressRegion} onChange={(e) => set('addressRegion', e.target.value)} placeholder="TN" />
                </div>
                <div>
                  <label className={label}>ZIP</label>
                  <input className={input} value={form.postalCode} onChange={(e) => set('postalCode', e.target.value)} />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Areas you serve</label>
                <input className={input} value={form.serviceArea} onChange={(e) => set('serviceArea', e.target.value)} placeholder="Nashville and Middle Tennessee" />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-1">Where should new leads go?</h2>
            <p className="text-xs text-gray-500 mb-4">When a visitor requests a quote, we&apos;ll notify you here. Leave blank to use your business contact above.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={label}>Lead notification email</label>
                <input className={input} type="email" value={form.notificationEmail} onChange={(e) => set('notificationEmail', e.target.value)} />
              </div>
              <div>
                <label className={label}>Mobile for text alerts</label>
                <input className={input} value={form.notificationPhone} onChange={(e) => set('notificationPhone', e.target.value)} />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-4">Services &amp; pricing</h2>
            <label className={label}>Which services do you offer?</label>
            <div className="space-y-4 mb-4">
              {SERVICE_GROUPS_ORDER.map((group) => {
                const items = SERVICE_GROUPS.get(group) ?? [];
                if (items.length === 0) return null;
                return (
                  <div key={group}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{group}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {items.map((def) => (
                        <label
                          key={def.label}
                          className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer ${form.services.includes(def.label) ? 'border-indigo-500 bg-indigo-50 text-gray-900' : 'border-gray-300 text-gray-600'}`}
                        >
                          <input
                            type="checkbox"
                            checked={form.services.includes(def.label)}
                            onChange={() => toggle('services', def.label)}
                          />
                          {def.label}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Custom</p>
                <label
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer ${form.services.includes(OTHER_SERVICE_LABEL) ? 'border-indigo-500 bg-indigo-50 text-gray-900' : 'border-gray-300 text-gray-600'}`}
                >
                  <input
                    type="checkbox"
                    checked={form.services.includes(OTHER_SERVICE_LABEL)}
                    onChange={() => toggle('services', OTHER_SERVICE_LABEL)}
                  />
                  Other (describe below)
                </label>
                {form.services.includes(OTHER_SERVICE_LABEL) && (
                  <input
                    className={`${input} mt-2`}
                    value={form.otherServices}
                    onChange={(e) => set('otherServices', e.target.value)}
                    placeholder="e.g. Wine cellars, closet accessories"
                    maxLength={120}
                    required
                  />
                )}
              </div>
            </div>
            <label className={label}>Pricing details (optional)</label>
            <textarea className={`${input} min-h-[80px]`} value={form.pricingNotes} onChange={(e) => set('pricingNotes', e.target.value)} placeholder="e.g. Walk-in closets start around $3,500. Garage systems $2,000–$8,000. If unsure, leave blank and we'll estimate." />
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-4">Brand &amp; look</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={label}>Logo (optional)</label>
                <input className="text-sm text-gray-600" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => onLogo(e.target.files?.[0] ?? null)} />
                {logoDataUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoDataUrl} alt="Logo preview" className="mt-2 h-12 object-contain" />
                )}
              </div>
              <div>
                <label className={label}>Brand color</label>
                <input className="h-10 w-20 rounded border border-gray-300" type="color" value={form.primaryColorHex} onChange={(e) => set('primaryColorHex', e.target.value)} />
              </div>
              <div>
                <label className={label}>Look &amp; feel</label>
                <select className={input} value={form.vibe} onChange={(e) => set('vibe', e.target.value)}>
                  <option value="">Choose…</option>
                  {VIBE_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className={label}>Writing tone</label>
                <select className={input} value={form.tone} onChange={(e) => set('tone', e.target.value)}>
                  <option value="">Choose…</option>
                  {TONE_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-4">About the business</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={label}>Ideal customers</label>
                <select className={input} value={form.customers} onChange={(e) => set('customers', e.target.value)}>
                  <option value="">Choose…</option>
                  {CUSTOMER_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className={label}>How established are you?</label>
                <select className={input} value={form.experience} onChange={(e) => set('experience', e.target.value)}>
                  <option value="">Choose…</option>
                  {EXPERIENCE_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className={label}>Main goal for the site</label>
                <select className={input} value={form.primaryCta} onChange={(e) => set('primaryCta', e.target.value)}>
                  <option value="">Choose…</option>
                  {CTA_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className={label}>Preferred web address (optional)</label>
                <input className={input} value={form.desiredDomain} onChange={(e) => set('desiredDomain', e.target.value)} placeholder="yourbusiness.com" />
              </div>
            </div>
            <div className="mt-4">
              <label className={label}>What makes you stand out?</label>
              <div className="grid grid-cols-2 gap-2">
                {DIFFERENTIATOR_OPTIONS.map((d) => (
                  <label key={d} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer ${form.differentiators.includes(d) ? 'border-indigo-500 bg-indigo-50 text-gray-900' : 'border-gray-300 text-gray-600'}`}>
                    <input type="checkbox" checked={form.differentiators.includes(d)} onChange={() => toggle('differentiators', d)} />
                    {d}
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <label className={label}>Anything else we should know?</label>
              <textarea className={`${input} min-h-[80px]`} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Special offers, awards, your story, etc." />
            </div>
          </section>

          {canUseImageStudio && studioServices.length > 0 && (
            <IntakeImageStudio
              token={token}
              services={studioServices}
              aiSiteConfig={aiSiteConfig as { hero?: { imagePrompt?: string }; products?: Array<{ title?: string; imagePrompt?: string }> } | null}
              imageSelections={imageSelections}
              onUpdate={(sel, site) => {
                setImageSelections(sel);
                if (site) setAiSiteConfig(site as Record<string, unknown>);
              }}
            />
          )}

          {intakeTier === 'ai_premium' && canUseImageStudio && !premiumImagesReady && (
            <p className="text-sm text-amber-800 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
              Complete the AI image studio (hero + each service) before submitting.
            </p>
          )}

          {error && <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

          <button
            type="button"
            disabled={submitting || (intakeTier === 'ai_premium' && !premiumImagesReady)}
            onClick={() => void submitForm()}
            className="w-full rounded-lg bg-indigo-600 px-6 py-3 font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit my details'}
          </button>
        </div>
      </div>
    </div>
  );
}
