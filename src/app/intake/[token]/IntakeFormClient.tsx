'use client';

import React, { useState } from 'react';

const SERVICE_OPTIONS = [
  'Walk-In Closets', 'Reach-In Closets', 'Garages', 'Pantries & Wine',
  'Home Offices', 'Mudrooms', 'Wall Beds', 'Entertainment Centers',
];
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
}: IntakeFormClientProps) {
  const [form, setForm] = useState<Form>(() => emptyForm(businessName));
  const [logoDataUrl, setLogoDataUrl] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(alreadySubmitted);
  const [error, setError] = useState('');
  const [manualBuild, setManualBuild] = useState(
    alreadySubmitted ? manualBuildOnSubmit : false
  );

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/intake/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, logoDataUrl: logoDataUrl || undefined }),
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
      <div className="min-h-screen grid place-items-center bg-gray-50 px-6 text-center">
        <div className="max-w-md">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-green-100 text-green-600">✓</div>
          <h1 className="text-xl font-semibold text-gray-900">Thank you!</h1>
          <p className="mt-2 text-sm text-gray-600">
            {manualBuild
              ? 'Your details have been received. Our team will build your custom site and quote calculator and email you when it is ready.'
              : 'Your details have been received. We are building your site and quote calculator in the background. Check your email for login credentials when provisioning completes.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="mx-auto max-w-2xl">
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

        <form onSubmit={submit} className="space-y-8">
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
            <div className="grid grid-cols-2 gap-2 mb-4">
              {SERVICE_OPTIONS.map((s) => (
                <label key={s} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer ${form.services.includes(s) ? 'border-indigo-500 bg-indigo-50 text-gray-900' : 'border-gray-300 text-gray-600'}`}>
                  <input type="checkbox" checked={form.services.includes(s)} onChange={() => toggle('services', s)} />
                  {s}
                </label>
              ))}
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

          {error && <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

          <button type="submit" disabled={submitting} className="w-full rounded-lg bg-indigo-600 px-6 py-3 font-bold text-white hover:bg-indigo-500 disabled:opacity-50">
            {submitting ? 'Submitting…' : 'Submit my details'}
          </button>
        </form>
      </div>
    </div>
  );
}
