'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import {
  SITE_PAGE_OPTIONS,
  RECOMMENDED_PAGE_SLUGS,
  sanitizePageSlugs,
  clampPagesForTier,
  maxPagesForTier,
  maxAdditionalPagesForTier,
} from '@/lib/catalog/sitePages';

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
  pages: string[];
};

const label = 'block text-sm font-medium text-gray-700 mb-1';
const input = 'w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none';

export type IntakeFormClientProps = {
  token: string;
  notFound?: boolean;
  businessName?: string;
  prospectEmail?: string;
  requestedPages?: string[];
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

function emptyForm(businessName: string, contactEmail = '', pages: string[] = []): Form {
  return {
    businessName,
    contactName: '',
    contactEmail,
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
    pages,
  };
}

export default function IntakeFormClient({
  token,
  notFound = false,
  businessName = '',
  prospectEmail = '',
  requestedPages = [],
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
  paymentDueLabel: initialPaymentDueLabel = '',
  paymentCheckoutKind: initialPaymentCheckoutKind = null,
  canPayToLaunch: initialCanPayToLaunch = false,
  paymentAmountCents: initialPaymentAmountCents = 0,
}: IntakeFormClientProps) {
  const router = useRouter();
  const tierPreselectDone = useRef(false);
  const payAutoDone = useRef(false);
  const paymentConfirmDone = useRef(false);
  const [form, setForm] = useState<Form>(() =>
    emptyForm(
      businessName,
      prospectEmail,
      requestedPages.length ? sanitizePageSlugs(requestedPages) : RECOMMENDED_PAGE_SLUGS
    )
  );
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
  const [paymentDueLabel, setPaymentDueLabel] = useState(initialPaymentDueLabel);
  const [paymentCheckoutKind, setPaymentCheckoutKind] = useState(initialPaymentCheckoutKind);
  const [canPayToLaunch, setCanPayToLaunch] = useState(initialCanPayToLaunch);
  const [paymentAmountCents, setPaymentAmountCents] = useState(initialPaymentAmountCents);
  const [launchPaid, setLaunchPaid] = useState(false);
  const [tenantSiteUrl, setTenantSiteUrl] = useState<string | null>(null);
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState('');
  const [aiSiteConfig, setAiSiteConfig] = useState(initialAiSite);
  const [imageSelections, setImageSelections] = useState(
    initialSelections ?? { hero: { attemptsUsed: 0, history: [] }, products: [] }
  );

  // Gallery images — parallel to the form but kept separate because they may
  // contain large data URLs that we don't want to serialize into the draft JSON.
  type GalleryEntry = { dataUrl: string; url: string };
  const [galleryCount, setGalleryCount] = useState(5);
  const [galleryImages, setGalleryImages] = useState<GalleryEntry[]>(() =>
    Array.from({ length: 10 }, () => ({ dataUrl: '', url: '' }))
  );

  const setGalleryEntry = (i: number, patch: Partial<GalleryEntry>) =>
    setGalleryImages((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));

  const onGalleryFile = (i: number, file: File | null) => {
    if (!file) { setGalleryEntry(i, { dataUrl: '' }); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Each gallery image must be under 10MB.'); return; }
    const reader = new FileReader();
    reader.onload = () =>
      setGalleryEntry(i, { dataUrl: typeof reader.result === 'string' ? reader.result : '', url: '' });
    reader.readAsDataURL(file);
  };

  // Auto-save form fields to localStorage so a reload / back-button / accidental
  // navigation doesn't wipe everything the user typed. Generated images and the
  // selected tier are persisted server-side and reload on their own.
  const draftKey = `closetquote-intake-draft-${token}`;
  const draftRestored = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || alreadySubmitted) {
      draftRestored.current = true;
      return;
    }
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (raw) {
        const saved = JSON.parse(raw) as { form?: Partial<Form>; logoDataUrl?: string };
        if (saved.form) {
          setForm((f) => ({
            ...f,
            ...saved.form,
            // Never let a stale draft override a locked, prefilled email.
            contactEmail: prospectEmail || saved.form?.contactEmail || f.contactEmail,
          }));
        }
        if (typeof saved.logoDataUrl === 'string' && saved.logoDataUrl) {
          setLogoDataUrl(saved.logoDataUrl);
        }
      }
    } catch {
      // Ignore malformed/unavailable storage.
    }
    draftRestored.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !draftRestored.current || submitted) return;
    try {
      window.localStorage.setItem(draftKey, JSON.stringify({ form, logoDataUrl }));
    } catch {
      // Storage full (often the logo data URL). Retry without the logo so at
      // least the typed fields survive.
      try {
        window.localStorage.setItem(draftKey, JSON.stringify({ form }));
      } catch {
        // Give up silently — persistence is best-effort.
      }
    }
  }, [form, logoDataUrl, draftKey, submitted]);

  useEffect(() => {
    if (typeof window === 'undefined' || paymentConfirmDone.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') !== 'success') return;
    paymentConfirmDone.current = true;
    const sessionId = params.get('session_id') || undefined;
    const returnKind = params.get('kind');

    fetch(`/api/intake/${token}/confirm-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (json.error) return;
        if (json.depositStatus) setDepositStatus(json.depositStatus);
        if (typeof json.canUseImageStudio === 'boolean') {
          setCanUseImageStudio(json.canUseImageStudio);
        }
        if (json.paymentDueLabel) setPaymentDueLabel(json.paymentDueLabel);
        if ('paymentCheckoutKind' in json) {
          setPaymentCheckoutKind(json.paymentCheckoutKind ?? null);
        }
        if (typeof json.canPayToLaunch === 'boolean') {
          setCanPayToLaunch(json.canPayToLaunch);
        }
        if (json.launchPaid) setLaunchPaid(true);
        if (json.tenantSiteUrl) setTenantSiteUrl(json.tenantSiteUrl);
        if (json.loginUrl) setLoginUrl(json.loginUrl);

        if (returnKind === 'deposit') {
          setPaymentSuccessMessage('Deposit received — you can continue in the AI image studio.');
        } else if (
          returnKind === 'balance' ||
          returnKind === 'standard_build'
        ) {
          setPaymentSuccessMessage(
            'Payment received — your site is live. Redirecting you now…'
          );
          const target = json.tenantSiteUrl || json.loginUrl;
          if (target) {
            window.setTimeout(() => {
              window.location.href = target;
            }, 2200);
          }
        } else if (returnKind === 'maintenance') {
          setPaymentSuccessMessage('Maintenance subscription started. Thank you!');
        }

        router.refresh();
        params.delete('payment');
        params.delete('kind');
        params.delete('session_id');
        const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
        window.history.replaceState({}, '', next);
      })
      .catch(() => {});
  }, [token, router]);

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
  const toggle = (key: 'services' | 'differentiators' | 'pages', value: string) =>
    setForm((f) => {
      const list = f[key];
      return { ...f, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] };
    });

  // Page selection is capped by build tier (Home is always included):
  // AI Premium = 10 total (9 extra), Standard = 5 total (4 extra).
  const maxTotalPages = maxPagesForTier(intakeTier);
  const maxExtraPages = maxAdditionalPagesForTier(intakeTier);
  const pagesAtCap = form.pages.length >= maxExtraPages;
  const togglePage = (slug: string) =>
    setForm((f) => {
      if (f.pages.includes(slug)) {
        return { ...f, pages: f.pages.filter((v) => v !== slug) };
      }
      if (f.pages.length >= maxExtraPages) return f; // enforce tier cap
      return { ...f, pages: [...f.pages, slug] };
    });

  // If the tier changes (e.g. Standard ↔ AI Premium) trim any pages that now
  // exceed the new cap so the selection always stays valid.
  useEffect(() => {
    setForm((f) => {
      const clamped = clampPagesForTier(f.pages, intakeTier);
      return clamped.length === f.pages.length ? f : { ...f, pages: clamped };
    });
  }, [intakeTier]);

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
          galleryImages: form.pages.includes('portfolio')
            ? galleryImages.slice(0, galleryCount).map(({ dataUrl, url }) => ({
                ...(dataUrl ? { dataUrl } : {}),
                ...(url.trim() ? { url: url.trim() } : {}),
              })).filter((e) => e.dataUrl || e.url)
            : [],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to submit');
      setManualBuild(!!json.manualBuild);
      setSubmitted(true);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem(draftKey);
        } catch {
          // Best-effort cleanup.
        }
      }
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
            {launchPaid
              ? 'Your launch payment is complete. Use the links below to view your site and sign in to the dashboard.'
              : manualBuild
                ? 'Your details have been received. Our team will build your custom site and quote calculator and email you when it is ready.'
                : 'Your details have been received. We are building your site and quote calculator in the background. Check your email for login credentials when provisioning completes.'}
          </p>
          {paymentSuccessMessage && (
            <p className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              {paymentSuccessMessage}
            </p>
          )}
          {launchPaid && (tenantSiteUrl || loginUrl) && (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              {tenantSiteUrl && (
                <a
                  href={tenantSiteUrl}
                  className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500"
                >
                  View your site
                </a>
              )}
              {loginUrl && (
                <a
                  href={loginUrl}
                  className="rounded-lg border border-indigo-300 px-5 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
                >
                  Contractor dashboard
                </a>
              )}
            </div>
          )}
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
                <input
                  className={`${input} ${prospectEmail ? 'cursor-not-allowed bg-gray-100 text-gray-500' : ''}`}
                  type="email"
                  required
                  value={form.contactEmail}
                  onChange={(e) => set('contactEmail', e.target.value)}
                  readOnly={!!prospectEmail}
                  disabled={!!prospectEmail}
                />
                {prospectEmail && (
                  <p className="mt-1 text-xs text-gray-500">
                    This is the email your setup link was sent to and can&apos;t be changed.
                  </p>
                )}
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

          <section className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-1">Pages for your site</h2>
            <p className="text-sm text-gray-500 mb-4">
              Your <span className="font-medium text-gray-700">Home</span> page is always
              included. Your{' '}
              <span className="font-medium text-gray-700">
                {intakeTier === 'ai_premium' ? 'AI Premium' : 'Standard'}
              </span>{' '}
              build includes up to{' '}
              <span className="font-medium text-gray-700">{maxTotalPages} pages total</span>{' '}
              — Home plus {maxExtraPages} you choose below. Whatever you pick here is exactly
              what we build. Not sure? The recommended set is a great starting point.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SITE_PAGE_OPTIONS.map((p) => {
                const checked = form.pages.includes(p.slug);
                const disabled = !checked && pagesAtCap;
                return (
                  <label
                    key={p.slug}
                    className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${checked ? 'border-indigo-500 bg-indigo-50 text-gray-900' : 'border-gray-300 text-gray-600'}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => togglePage(p.slug)}
                    />
                    <span>
                      <span className="font-medium text-gray-900">{p.label}</span>
                      {p.recommended && (
                        <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                          Recommended
                        </span>
                      )}
                      <span className="block text-xs text-gray-500">{p.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-gray-500">
              {form.pages.length + 1} of {maxTotalPages} page{maxTotalPages === 1 ? '' : 's'} selected
              (including Home).
              {pagesAtCap && (
                <span className="ml-1 font-medium text-amber-700">
                  You&apos;ve reached your plan&apos;s page limit
                  {intakeTier !== 'ai_premium' ? ' — upgrade to AI Premium for up to 10 pages.' : '.'}
                </span>
              )}
            </p>
          </section>

          {/* Gallery images — shown when Portfolio / Gallery page is selected */}
          {form.pages.includes('portfolio') && (
            <section className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-1">
                Portfolio / Gallery images
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Your gallery page needs real photos of work you&apos;ve done yourself — before &amp; after
                shots, finished installs, happy clients, etc. Without your own project photos we
                cannot configure the Portfolio page.
              </p>

              {/* Count selector */}
              <div className="mb-5">
                <label className={label}>How many gallery images would you like to include?</label>
                <select
                  className={`${input} w-40`}
                  value={galleryCount}
                  onChange={(e) => setGalleryCount(Number(e.target.value))}
                >
                  {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                    <option key={n} value={n}>{n} images</option>
                  ))}
                </select>
              </div>

              {/* Per-image upload / URL inputs */}
              <div className="space-y-4">
                {Array.from({ length: galleryCount }, (_, i) => {
                  const entry = galleryImages[i] ?? { dataUrl: '', url: '' };
                  const hasContent = !!(entry.dataUrl || entry.url.trim());
                  return (
                    <div key={i} className={`rounded-lg border p-4 ${hasContent ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200'}`}>
                      <p className="text-sm font-medium text-gray-700 mb-3">
                        Image {i + 1}
                        {hasContent && (
                          <span className="ml-2 text-indigo-600 text-xs font-normal">✓ Ready</span>
                        )}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Upload a file</label>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="text-sm text-gray-600 w-full"
                            onChange={(e) => onGalleryFile(i, e.target.files?.[0] ?? null)}
                          />
                          {entry.dataUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={entry.dataUrl}
                              alt={`Gallery preview ${i + 1}`}
                              className="mt-2 h-20 w-full object-cover rounded"
                            />
                          )}
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            Or paste an image URL
                          </label>
                          <input
                            className={input}
                            type="url"
                            placeholder="https://example.com/photo.jpg"
                            value={entry.url}
                            disabled={!!entry.dataUrl}
                            onChange={(e) =>
                              setGalleryEntry(i, { url: e.target.value, dataUrl: '' })
                            }
                          />
                          {entry.url.trim() && !entry.dataUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={entry.url.trim()}
                              alt={`Gallery preview ${i + 1}`}
                              className="mt-2 h-20 w-full object-cover rounded"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Warning if no images provided */}
              {galleryImages.slice(0, galleryCount).every((e) => !e.dataUrl && !e.url.trim()) && (
                <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  No gallery images added yet. If you don&apos;t upload any photos we won&apos;t be
                  able to configure your Portfolio page — it will be excluded from your site.
                </p>
              )}
            </section>
          )}

          {canUseImageStudio && studioServices.length > 0 && (
            <IntakeImageStudio
              token={token}
              services={studioServices}
              pages={form.pages}
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
