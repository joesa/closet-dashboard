'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import PresentationReviewStep from './PresentationReviewStep';
import { inferQuoteCalculatorGuidance } from '@/lib/quoteCalculatorGuidance';
import {
  SITE_PAGE_OPTIONS,
  RECOMMENDED_PAGE_SLUGS,
  sanitizePageSlugs,
  clampPagesForTier,
  maxPagesForTier,
  maxAdditionalPagesForTier,
} from '@/lib/catalog/sitePages';
import { listIndustries, resolveIndustrySlug, getIndustry, getEngagementModel, isLowConfidenceResolution } from '@/lib/catalog/serviceCatalog';

/** Split the free-text services field into individual service/job labels. */
function parseServiceList(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function industryExampleLabels(tradeLabel: string): string[] {
  const key = tradeLabel.toLowerCase();
  if (key.includes('plumb')) return ['Plumbing', 'Plumbing & Drain', 'Residential Plumbing'];
  if (key.includes('hvac') || key.includes('heating')) return ['HVAC', 'Heating & Cooling', 'HVAC Service & Install'];
  if (key.includes('tow')) return ['Towing', 'Roadside Assistance', 'Towing & Recovery'];
  if (key.includes('landscap')) return ['Landscaping', 'Landscape Design & Build', 'Lawn & Landscape'];
  if (key.includes('clean')) return ['Cleaning', 'Residential Cleaning', 'Commercial Cleaning'];
  if (key.includes('storage') || key.includes('closet')) {
    return ['Custom Closets', 'Custom Storage', 'Closets & Home Organization'];
  }
  return ['General Contracting', 'Home Services', 'Specialty Trade Services'];
}

function pricingModelLabel(model: 'linear_ft' | 'fixed' | 'base_plus_distance'): string {
  if (model === 'fixed') return 'Flat per job';
  if (model === 'base_plus_distance') return 'Base + distance';
  return 'Per unit / size';
}

const VIBE_OPTIONS = [
  'Luxury & minimal', 'Bold & industrial', 'Warm & classic', 'Modern & clean',
  'Playful & friendly', 'Rustic & natural', 'Elegant & refined', 'Sleek & high-tech',
];
const TONE_OPTIONS = ['Professional & trustworthy', 'Friendly & approachable', 'Bold & confident', 'Elegant & refined'];
const CUSTOMER_OPTIONS = ['Luxury homeowners', 'Busy families', 'Budget-conscious homeowners', 'Builders & commercial clients', 'A mix of everyone'];
const EXPERIENCE_OPTIONS = ['Just getting started', '1–5 years', '5–15 years', '15+ years / well established'];
const DIFFERENTIATOR_OPTIONS = ['Lifetime warranty', 'Free in-home consultation', 'Made in USA', 'Family-owned', 'Award-winning', 'Eco-friendly materials', 'Fast turnaround', 'Financing available'];
const CTA_OPTIONS = ['Book a free consultation', 'Request a quote', 'Call now', 'Browse the portfolio'];
const EXTRA_INDUSTRY_OPTIONS = [
  'Auto Detailing',
  'Car Wrapping',
  'PPF (Paint Protection Film)',
  'Window Tinting',
  'Mobile Mechanic',
  'General Contractor',
  'Remodeling Contractor',
  'Roofing Contractor',
  'Plumbing Contractor',
  'HVAC Contractor',
  'Electrical Contractor',
  'Landscaping Contractor',
  'Pool Contractor',
  'Fence Contractor',
  'Deck Builder',
  'Concrete Contractor',
  'Masonry Contractor',
  'Cabinetry & Millwork',
  'Home Theater Installation',
  'Smart Home Installation',
  'Glass & Mirror Installation',
  'Commercial Janitorial',
  'Property Maintenance',
  'Restoration Services',
];
const INDUSTRY_OPTIONS = Array.from(
  new Set([
    ...listIndustries().map((industry) => industry.label),
    ...EXTRA_INDUSTRY_OPTIONS,
  ])
).sort((a, b) => a.localeCompare(b));
const CUSTOM_INDUSTRY_VALUE = '__other__';

/** One row in the "Menu Items" editor — order-industry businesses only
 *  (e.g. restaurants-bars). See EngagementModel in @/lib/catalog/types. */
type MenuItemDraft = {
  id: string;
  name: string;
  price: string;
  category: string;
};

type Form = {
  businessName: string;
  industry: string;
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
  menuItems: MenuItemDraft[];
  pricingModel: 'linear_ft' | 'fixed';
  tierNameBasic: string;
  tierNameStandard: string;
  tierNamePremium: string;
  seedBasic: string;
  seedStandard: string;
  seedPremium: string;
  hasFinishes: boolean;
  finish1Label: string;
  finish1Color: string;
  finish2Label: string;
  finish2Color: string;
  finish3Label: string;
  finish3Color: string;
  addOnText: string;
  calculatorNotes: string;
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
  pageContents: Record<string, string>;
};

type WidgetHintsSnapshot = {
  industry?: string;
  pricingModel?: 'linear_ft' | 'fixed' | 'per_unit' | 'flat_tiered' | 'base_plus_distance';
  tierNames?: { basic?: string; standard?: string; premium?: string };
  seedPricing?: { basic?: number; standard?: number; premium?: number };
  hasFinishes?: boolean;
  finishLabels?: Array<{ label?: string; swatchHex?: string }>;
  addOnText?: string;
  calculatorNotes?: string;
};

type IntakeDraftSnapshot = {
  form?: Partial<Form>;
  selectedGeneratedLogoUrl?: string;
  currentStep?: number;
};

function compactPageContentsForDraft(
  pageContents: Record<string, string>
): Record<string, string> {
  const compact: Record<string, string> = {};
  for (const [slug, content] of Object.entries(pageContents || {})) {
    if (typeof content !== 'string') continue;
    const trimmed = content.trim();
    if (!trimmed) continue;
    // Keep drafts well under storage limits while preserving meaningful edits.
    compact[slug] = trimmed.slice(0, 4000);
  }
  return compact;
}

function buildDraftSnapshot(
  form: Form,
  selectedGeneratedLogoUrl: string,
  currentStep: number
): IntakeDraftSnapshot {
  return {
    form: {
      ...form,
      pageContents: compactPageContentsForDraft(form.pageContents),
    },
    selectedGeneratedLogoUrl: selectedGeneratedLogoUrl || undefined,
    currentStep,
  };
}

const label = 'mb-2 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500';
const input = 'w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-white/30 focus:bg-white/[0.07] sm:px-4 sm:py-3';
const selectInput = `${input} appearance-none [&>option]:bg-zinc-900 [&>option]:text-white`;
const selectOption = 'bg-zinc-900 text-white';
const sectionClass = 'rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-6';
const sectionTitle = 'mb-4 text-[11px] font-semibold uppercase tracking-widest text-zinc-500';

export type IntakeFormClientProps = {
  token: string;
  isAdmin?: boolean;
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
  /** True when the contractor already picked Standard/AI Premium before
   *  reaching this form (get-started flow or a tier-specific email link) —
   *  hides the redundant "Choose your setup package" TierPicker. */
  tierAlreadySelected?: boolean;
  canUseImageStudio?: boolean;
  tierCatalog?: IntakeTierCatalogEntry[];
  aiSiteConfig?: Record<string, unknown> | null;
  widgetConfigHints?: Record<string, unknown> | null;
  imageSelections?: IntakeImageSelections;
  pageContents?: Record<string, string>;
  initialTierFromQuery?: string;
  payKindFromQuery?: IntakeCheckoutKind;
  paymentDueLabel?: string;
  paymentCheckoutKind?: IntakeCheckoutKind | null;
  canPayToLaunch?: boolean;
  paymentAmountCents?: number;
};

function emptyForm(
  businessName: string,
  contactEmail = '',
  pages: string[] = [],
  pageContents?: Record<string, string>,
  widgetHints?: WidgetHintsSnapshot | null
): Form {
  const finishes = widgetHints?.finishLabels ?? [];
  return {
    businessName,
    industry: widgetHints?.industry?.trim() || '',
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
    menuItems: [],
    pricingModel: widgetHints?.pricingModel === 'fixed' || widgetHints?.pricingModel === 'flat_tiered' ? 'fixed' : 'linear_ft',
    tierNameBasic: widgetHints?.tierNames?.basic || 'Basic',
    tierNameStandard: widgetHints?.tierNames?.standard || 'Standard',
    tierNamePremium: widgetHints?.tierNames?.premium || 'Premium',
    seedBasic: Number.isFinite(widgetHints?.seedPricing?.basic) ? String(widgetHints?.seedPricing?.basic) : '',
    seedStandard: Number.isFinite(widgetHints?.seedPricing?.standard) ? String(widgetHints?.seedPricing?.standard) : '',
    seedPremium: Number.isFinite(widgetHints?.seedPricing?.premium) ? String(widgetHints?.seedPricing?.premium) : '',
    hasFinishes: !!widgetHints?.hasFinishes,
    finish1Label: finishes[0]?.label || '',
    finish1Color: finishes[0]?.swatchHex || '#C8A97E',
    finish2Label: finishes[1]?.label || '',
    finish2Color: finishes[1]?.swatchHex || '#8B6F47',
    finish3Label: finishes[2]?.label || '',
    finish3Color: finishes[2]?.swatchHex || '#3D2B1F',
    addOnText: widgetHints?.addOnText || '',
    calculatorNotes: widgetHints?.calculatorNotes || '',
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
    pageContents: pageContents || {},
  };
}

/** Guided-wizard progress indicator: "Step X of Y — Title" plus clickable
 * dots for any step already visited, so users can jump back without losing
 * anything (nothing unmounts — steps are just shown/hidden). */
function IntakeStepProgress({
  steps,
  currentStepIndex,
  maxStepIndexVisited,
  onSelect,
}: {
  steps: { key: string; title: string }[];
  currentStepIndex: number;
  maxStepIndexVisited: number;
  onSelect: (idx: number) => void;
}) {
  const current = steps[currentStepIndex];
  return (
    <div className="mb-5 sm:mb-6">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Step {currentStepIndex + 1} of {steps.length} — {current?.title}
        </p>
        <p className="text-[11px] text-zinc-600">
          {Math.round(((currentStepIndex + 1) / steps.length) * 100)}%
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        {steps.map((s, i) => {
          const visited = i <= maxStepIndexVisited;
          const active = i === currentStepIndex;
          return (
            <button
              key={s.key}
              type="button"
              title={s.title}
              aria-label={`Go to step ${i + 1}: ${s.title}`}
              aria-current={active ? 'step' : undefined}
              disabled={!visited}
              onClick={() => onSelect(i)}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                active
                  ? 'bg-indigo-400'
                  : visited
                    ? 'cursor-pointer bg-indigo-400/40 hover:bg-indigo-400/70'
                    : 'cursor-not-allowed bg-white/[0.08]'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function IntakeFormClient({
  token,
  isAdmin = false,
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
  tierAlreadySelected = false,
  canUseImageStudio: initialCanStudio = false,
  tierCatalog = [],
  aiSiteConfig: initialAiSite = null,
  widgetConfigHints = null,
  imageSelections: initialSelections,
  pageContents,
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
      requestedPages.length ? sanitizePageSlugs(requestedPages) : RECOMMENDED_PAGE_SLUGS,
      pageContents,
      widgetConfigHints as WidgetHintsSnapshot | null
    )
  );
  const [logoDataUrl, setLogoDataUrl] = useState<string>('');
  const [generatedLogoUrls, setGeneratedLogoUrls] = useState<string[]>([]);
  const [selectedGeneratedLogoUrl, setSelectedGeneratedLogoUrl] = useState<string>('');
  const [generatingLogos, setGeneratingLogos] = useState(false);
  const [logoGenAttemptsUsed, setLogoGenAttemptsUsed] = useState(0);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const logoGenMaxAttempts = 5;
  const [customerOptions, setCustomerOptions] = useState<string[]>(CUSTOMER_OPTIONS);
  const [suggestingCustomers, setSuggestingCustomers] = useState(false);
  const [customerOptionsSource, setCustomerOptionsSource] = useState<'default' | 'gemini'>('default');
  // Contractor-contributed industries (not in the static catalog) fetched
  // from the DB so they show up as first-class dropdown options for future
  // contractors, not just the "Other" free-text escape hatch.
  const [customIndustryLabels, setCustomIndustryLabels] = useState<string[]>([]);
  // AI-resolved service suggestions for a custom (non-catalog) industry the
  // contractor just typed — takes over from the static catalog guess in
  // `suggestedServices` once populated. null = not resolved yet / not needed.
  const [customIndustryServices, setCustomIndustryServices] = useState<string[] | null>(null);
  const [resolvingCustomIndustry, setResolvingCustomIndustry] = useState(false);
  const lastResolvedIndustryText = useRef<string>('');
  // Tracks the industry+services combo the "Ideal customers" dropdown was
  // last auto-suggested for, so it only re-fetches when something relevant
  // actually changed (not on every unrelated re-render/step navigation).
  const lastSuggestedCustomersKey = useRef<string>('');
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
  const [generatingCopy, setGeneratingCopy] = useState<Record<string, boolean>>({});
  const [expandedPage, setExpandedPage] = useState<string | null>(null);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [servicesBlurGuidance, setServicesBlurGuidance] = useState<ReturnType<
    typeof inferQuoteCalculatorGuidance
  > | null>(null);

  // Guided step wizard — the form is broken into steps so it doesn't feel like
  // one overwhelming wall of fields. All existing sections/fields/logic below
  // are unchanged; steps just control which section(s) are visible at once.
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [maxStepIndexVisited, setMaxStepIndexVisited] = useState(0);

  // Presentation review step
  type ThemeTokenSelection = { surface: string; shape: string; voice: string; swatch: string };
  type PreviewResult = {
    theme: string;
    layoutStyle: string;
    allowedThemes: string[];
    allowedLayouts: string[];
    themeTokens?: ThemeTokenSelection | null;
    isSynthesized?: boolean;
  };
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [pendingTheme, setPendingTheme] = useState('');
  const [pendingLayout, setPendingLayout] = useState('');
  const reviewRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRefs = useRef<(HTMLInputElement | null)[]>([]);

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

  const bulkGalleryInputRef = useRef<HTMLInputElement | null>(null);

  // Let the user pick multiple files in one dialog and fill Image 1, 2, 3…
  // in order, instead of uploading each slot one at a time.
  const onBulkGalleryFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const picked = Array.from(files).slice(0, galleryCount);
    const oversized = picked.filter((f) => f.size > 10 * 1024 * 1024);
    if (oversized.length > 0) {
      setError('Each gallery image must be under 10MB — some files were skipped.');
    }
    picked
      .filter((f) => f.size <= 10 * 1024 * 1024)
      .forEach((file, i) => {
        const reader = new FileReader();
        reader.onload = () =>
          setGalleryEntry(i, { dataUrl: typeof reader.result === 'string' ? reader.result : '', url: '' });
        reader.readAsDataURL(file);
      });
  };

  // Load contractor-contributed custom industries (see
  // /api/catalog/custom-industries) so they show up in the industry dropdown
  // alongside the static catalog + EXTRA_INDUSTRY_OPTIONS.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/catalog/custom-industries')
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { industries?: Array<{ label: string }> } | null) => {
        if (cancelled || !json?.industries) return;
        setCustomIndustryLabels(json.industries.map((i) => i.label).filter(Boolean));
      })
      .catch(() => {
        // Non-critical — the static catalog + "Other" free-text option still work.
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
        const saved = JSON.parse(raw) as IntakeDraftSnapshot;
        if (saved.form) {
          setForm((f) => ({
            ...f,
            ...saved.form,
            contactEmail: prospectEmail || saved.form?.contactEmail || f.contactEmail,
            pageContents: {
              ...f.pageContents,
              ...(saved.form?.pageContents || {}),
            },
          }));
        }
        if (
          typeof saved.selectedGeneratedLogoUrl === 'string' &&
          saved.selectedGeneratedLogoUrl
        ) {
          setSelectedGeneratedLogoUrl(saved.selectedGeneratedLogoUrl);
        }
        if (typeof saved.currentStep === 'number' && saved.currentStep >= 0) {
          setCurrentStepIndex(saved.currentStep);
          setMaxStepIndexVisited(saved.currentStep);
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
      window.localStorage.setItem(
        draftKey,
        JSON.stringify(buildDraftSnapshot(form, selectedGeneratedLogoUrl, currentStepIndex))
      );
    } catch {
      // Best-effort fallback: strip page copy entirely if storage is constrained.
      try {
        const minimal = {
          ...form,
          pageContents: {},
        };
        window.localStorage.setItem(
          draftKey,
          JSON.stringify({ form: minimal, selectedGeneratedLogoUrl, currentStep: currentStepIndex })
        );
      } catch {
        // Give up silently — persistence is best-effort.
      }
    }
  }, [form, logoDataUrl, selectedGeneratedLogoUrl, draftKey, submitted, currentStepIndex]);

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
  const setBool = <K extends keyof Form>(key: K, value: boolean) =>
    setForm((f) => ({ ...f, [key]: value as Form[K] }));
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
    reader.onload = () => {
      setLogoDataUrl(typeof reader.result === 'string' ? reader.result : '');
      setSelectedGeneratedLogoUrl('');
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateLogos = async () => {
    const serviceNames = [
      ...form.services,
      ...parseServiceList(form.otherServices)
    ];
    if (serviceNames.length === 0 && form.industry.trim().length > 0) {
      serviceNames.push(form.industry.trim());
    }
    if (serviceNames.length === 0) {
      setError('Select an industry or list at least one service first so we can infer logo concepts.');
      return;
    }
    setGeneratingLogos(true);
    setError('');
    try {
      const res = await fetch(`/api/intake/${token}/generate-logo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceNames,
          businessName: form.businessName,
          primaryColorHex: form.primaryColorHex,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to generate logos');
      const urls = Array.isArray(json.urls)
        ? json.urls.filter((u: unknown): u is string => typeof u === 'string')
        : [];
      setGeneratedLogoUrls(urls.slice(0, 3));
      setLogoDataUrl('');
      // Auto-select the AI's top pick so users aren't forced to manually
      // choose; they can still click a different option to override it.
      setSelectedGeneratedLogoUrl(urls[0] || '');
      if (typeof json.attemptsUsed === 'number') {
        setLogoGenAttemptsUsed(json.attemptsUsed);
      }
    } catch (err) {
      if (
        err instanceof Error &&
        /no ai logo generation attempts remaining/i.test(err.message)
      ) {
        setLogoGenAttemptsUsed(logoGenMaxAttempts);
      }
      setError(err instanceof Error ? err.message : 'Failed to generate logos');
    } finally {
      setGeneratingLogos(false);
    }
  };

  /** Core "ideal customers" AI suggestion call, shared by the manual
   *  "✨ Suggest for my trade" button and the automatic triggers below. */
  const runSuggestCustomers = async () => {
    setSuggestingCustomers(true);
    setError('');
    try {
      const res = await fetch(`/api/intake/${token}/suggest-customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: form.industry,
          services: studioServices,
          otherServices: form.otherServices,
          businessName: form.businessName,
          differentiators: form.differentiators,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to suggest ideal customers');
      const options = Array.isArray(json.options)
        ? json.options.filter((o: unknown): o is string => typeof o === 'string')
        : [];
      if (options.length > 0) {
        // Keep the current selection in the list even if the AI list doesn't
        // include it, so we never silently orphan what the user already picked.
        const merged =
          form.customers && !options.includes(form.customers)
            ? [...options, form.customers]
            : options;
        setCustomerOptions(merged);
        setCustomerOptionsSource(json.source === 'gemini' ? 'gemini' : 'default');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to suggest ideal customers');
    } finally {
      setSuggestingCustomers(false);
    }
  };

  /** Manual "✨ Suggest for my trade" button — always re-rolls, even if the
   *  industry/services haven't changed since the last suggestion. */
  const handleSuggestCustomers = async () => {
    lastSuggestedCustomersKey.current = suggestCustomersKey(form.industry, form.otherServices);
    await runSuggestCustomers();
  };

  const suggestCustomersKey = (industryText: string, servicesText: string) => {
    const services = parseServiceList(servicesText)
      .map((s) => s.toLowerCase())
      .sort()
      .join(',');
    return `${industryText.trim().toLowerCase()}|${services}`;
  };

  /** Auto-infers "ideal customers" from the industry + services as soon as
   *  both are known, so the dropdown reflects the actual trade instead of
   *  sitting on the generic hardcoded default until the contractor notices
   *  and clicks the manual button. Skips if nothing relevant changed since
   *  the last suggestion (avoids redundant calls on unrelated re-renders). */
  const maybeAutoSuggestCustomers = (industryText: string, servicesText: string) => {
    if (industryText.trim().length < 3) return;
    const key = suggestCustomersKey(industryText, servicesText);
    if (key === lastSuggestedCustomersKey.current) return;
    lastSuggestedCustomersKey.current = key;
    void runSuggestCustomers();
  };


  const handleGeneratePageCopy = async (slug: string) => {
    if (generatingCopy[slug]) return;
    setGeneratingCopy((prev) => ({ ...prev, [slug]: true }));
    setError('');

    try {
      const res = await fetch(`/api/intake/${token}/generate-page-copy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, ...form }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to generate copy');
      if (json.content) {
        setForm((f) => ({
          ...f,
          pageContents: {
            ...f.pageContents,
            [slug]: json.content,
          },
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate copy');
    } finally {
      setGeneratingCopy((prev) => ({ ...prev, [slug]: false }));
    }
  };

  const handleGenerateAllPageCopy = useCallback(async () => {
    const slugsToGenerate = form.pages.filter((slug) => !form.pageContents[slug]?.trim());
    if (slugsToGenerate.length === 0) return;
    setBulkGenerating(true);
    setBulkProgress({ current: 0, total: slugsToGenerate.length });
    for (let i = 0; i < slugsToGenerate.length; i++) {
      const slug = slugsToGenerate[i];
      setBulkProgress({ current: i + 1, total: slugsToGenerate.length });
      setGeneratingCopy((prev) => ({ ...prev, [slug]: true }));
      try {
        const res = await fetch(`/api/intake/${token}/generate-page-copy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, ...form }),
        });
        const json = await res.json();
        if (res.ok && json.content) {
          setForm((f) => ({
            ...f,
            pageContents: { ...f.pageContents, [slug]: json.content },
          }));
        }
      } catch {
        // Continue to next page on failure
      } finally {
        setGeneratingCopy((prev) => ({ ...prev, [slug]: false }));
      }
    }
    setBulkGenerating(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, token]);

  /** Validate form fields + call preview-presentation API to show the review step. */
  const handleReviewClick = async () => {
    const serviceList = parseServiceList(form.otherServices);
    if (serviceList.length === 0) {
      setError('List at least one service or job you offer.');
      return;
    }
    if (intakeTier === 'ai_premium' && depositRequiredCents > 0 && depositStatus !== 'paid') {
      setError('Pay the 30% deposit before submitting.');
      return;
    }
    for (const [slug, content] of Object.entries(form.pageContents)) {
      if (form.pages.includes(slug) && content) {
        const count = content.trim().split(/\s+/).filter(Boolean).length;
        if (count > 1200) {
          const opt = SITE_PAGE_OPTIONS.find((p) => p.slug === slug);
          setError(`The page "${opt?.label || slug}" exceeds the 1,200-word limit (${count} words).`);
          return;
        }
      }
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(`/api/intake/${token}/preview-presentation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: form.industry,
          services: parseServiceList(form.otherServices),
          otherServices: form.otherServices,
          vibe: form.vibe,
          primaryCta: form.primaryCta,
          businessName: form.businessName,
        }),
      });
      const json = await res.json() as PreviewResult;
      setPreviewResult(json);
      setPendingTheme(json.theme);
      setPendingLayout(json.layoutStyle);
      // Scroll to review panel
      setTimeout(() => reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch {
      setError('Could not preview site design. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const studioServices = useMemo(() => {
    const fromOther = parseServiceList(form.otherServices);
    const fromCheckboxes = form.services || [];
    const merged = [...fromCheckboxes, ...fromOther];
    if (merged.length === 0 && form.industry.trim()) {
      return [form.industry.trim()];
    }
    return merged;
  }, [form.services, form.otherServices, form.industry]);

  /** Deterministic quote-vs-order detection (see EngagementModel in
   *  @/lib/catalog/types) — a pure catalog lookup, computed client-side from
   *  whatever industry/services text has been entered so far. Gates whether
   *  the "Menu Items" editor (below) replaces the pricing-model/tier/seed-
   *  pricing blocks that only make sense for a quote calculator. */
  const isOrderBusiness = useMemo(() => {
    const industryText =
      form.industry.trim() || (widgetConfigHints as WidgetHintsSnapshot | null)?.industry || '';
    if (!industryText.trim() && studioServices.length === 0) return false;
    const slug = resolveIndustrySlug({ industry: industryText, services: studioServices });
    return getEngagementModel(slug) === 'order';
  }, [form.industry, studioServices, widgetConfigHints]);

  const isBookingBusiness = useMemo(() => {
    const industryText =
      form.industry.trim() || (widgetConfigHints as WidgetHintsSnapshot | null)?.industry || '';
    if (!industryText.trim() && studioServices.length === 0) return false;
    const slug = resolveIndustrySlug({ industry: industryText, services: studioServices });
    return getEngagementModel(slug) === 'booking';
  }, [form.industry, studioServices, widgetConfigHints]);

  const isTicketBusiness = useMemo(() => {
    const industryText =
      form.industry.trim() || (widgetConfigHints as WidgetHintsSnapshot | null)?.industry || '';
    if (!industryText.trim() && studioServices.length === 0) return false;
    const slug = resolveIndustrySlug({ industry: industryText, services: studioServices });
    return getEngagementModel(slug) === 'ticket';
  }, [form.industry, studioServices, widgetConfigHints]);

  const addMenuItem = () => {
    set('menuItems', [
      ...form.menuItems,
      { id: `mi-${Date.now()}-${form.menuItems.length}`, name: '', price: '', category: '' },
    ]);
  };
  const updateMenuItem = (id: string, patch: Partial<MenuItemDraft>) => {
    set(
      'menuItems',
      form.menuItems.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };
  const removeMenuItem = (id: string) => {
    set('menuItems', form.menuItems.filter((item) => item.id !== id));
  };

  const calculatorGuidance = useMemo(
    () =>
      inferQuoteCalculatorGuidance({
        industry:
          form.industry ||
          (widgetConfigHints as WidgetHintsSnapshot | null)?.industry,
        servicesText: form.otherServices,
        services: studioServices,
      }),
    [form.industry, form.otherServices, studioServices, widgetConfigHints]
  );

  const applyServicesGuidance = (servicesText: string) => {
    const industry = form.industry.trim();
    maybeAutoSuggestCustomers(industry, servicesText);
    const services = parseServiceList(servicesText);
    if (!industry || services.length === 0) {
      setServicesBlurGuidance(null);
      return;
    }
    const guidance = inferQuoteCalculatorGuidance({
      industry,
      servicesText,
      services,
    });
    setServicesBlurGuidance(guidance);
    set(
      'pricingModel',
      guidance.recommendedPricingModel === 'linear_ft' ? 'linear_ft' : 'fixed'
    );
  };
  const handleServicesBlur = () => applyServicesGuidance(form.otherServices);

  /** Curated per-industry service list (from the service catalog) shown as
   *  clickable suggestion chips so non-technical contractors don't have to
   *  think up their own service names from scratch. For a genuinely new
   *  (non-catalog) industry, `customIndustryServices` (AI-resolved via
   *  /api/intake/[token]/resolve-custom-industry on blur) takes over instead
   *  of the static catalog's best-effort (often irrelevant) keyword guess. */
  const suggestedServices = useMemo(() => {
    if (customIndustryServices && customIndustryServices.length > 0) {
      return customIndustryServices;
    }
    const industryText =
      form.industry.trim() ||
      (widgetConfigHints as WidgetHintsSnapshot | null)?.industry ||
      '';
    if (!industryText.trim()) return [];
    if (isLowConfidenceResolution({ industry: industryText })) return [];
    
    const slug = resolveIndustrySlug({ industry: industryText });
    const industry = getIndustry(slug);
    const seen = new Set<string>();
    const labels: string[] = [];
    for (const svc of industry.services) {
      const key = svc.label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      labels.push(svc.label);
    }
    return labels;
  }, [form.industry, widgetConfigHints, customIndustryServices]);

  const selectedServiceLabels = useMemo(
    () => new Set(studioServices.map((s) => s.toLowerCase())),
    [studioServices]
  );

  const toggleSuggestedService = (svcLabel: string) => {
    const current = parseServiceList(form.otherServices);
    const exists = current.some((s) => s.toLowerCase() === svcLabel.toLowerCase());
    const next = exists
      ? current.filter((s) => s.toLowerCase() !== svcLabel.toLowerCase())
      : [...current, svcLabel];
    const nextText = next.join(', ');
    set('otherServices', nextText);
    applyServicesGuidance(nextText);
  };

  /** Appends/removes a "Ask about {variable}." sentence in calculatorNotes so
   *  contractors can click the AI-suggested quote inputs (e.g. "square
   *  footage", "number of stories" for roofing) instead of having to think up
   *  the right pricing variables themselves. */
  const toggleQuoteVariable = (variable: string) => {
    const phrase = `Ask about ${variable}.`;
    const already = form.calculatorNotes.toLowerCase().includes(variable.toLowerCase());
    if (already) {
      const next = form.calculatorNotes
        .split(phrase)
        .join('')
        .replace(/\s{2,}/g, ' ')
        .trim();
      set('calculatorNotes', next);
    } else {
      const next = form.calculatorNotes.trim()
        ? `${form.calculatorNotes.trim()} ${phrase}`
        : phrase;
      set('calculatorNotes', next);
    }
  };

  const industryExamples = useMemo(
    () => industryExampleLabels(calculatorGuidance.tradeLabel),
    [calculatorGuidance.tradeLabel]
  );
  /** Static catalog + EXTRA_INDUSTRY_OPTIONS + any DB-stored custom industries. */
  const allIndustryOptions = useMemo(
    () => Array.from(new Set([...INDUSTRY_OPTIONS, ...customIndustryLabels])).sort((a, b) => a.localeCompare(b)),
    [customIndustryLabels]
  );
  const matchedIndustryOption = useMemo(() => {
    const normalized = form.industry.trim().toLowerCase();
    if (!normalized) return '';
    return (
      allIndustryOptions.find((option) => option.toLowerCase() === normalized) ||
      ''
    );
  }, [form.industry, allIndustryOptions]);
  // Whether the "Other (enter custom industry)" option is active. This is a
  // dedicated flag (not purely derived from form.industry) because deriving
  // it from text alone breaks the very first click: form.industry starts
  // empty, so "selecting Other" had no text to fall back on and the <select>
  // silently snapped back to the "Select your industry…" placeholder,
  // never revealing the free-text input.
  const [customIndustryMode, setCustomIndustryMode] = useState(false);
  const selectedIndustryValue =
    customIndustryMode || (form.industry.trim() && !matchedIndustryOption)
      ? CUSTOM_INDUSTRY_VALUE
      : matchedIndustryOption || '';

  /**
   * Resolves a contractor-typed custom industry (the "Other" free-text
   * option) via /api/intake/[token]/resolve-custom-industry: reuses an
   * existing catalog/custom match when possible, otherwise generates + saves
   * a brand-new industry definition (services, keywords, theme/layout pool,
   * and a required before/after image category) so it's usable immediately
   * for THIS contractor's service suggestions and selectable by future ones.
   */
  const handleCustomIndustryBlur = async () => {
    const industryText = form.industry.trim();
    if (
      !industryText ||
      industryText.length < 3 ||
      industryText === lastResolvedIndustryText.current ||
      matchedIndustryOption
    ) {
      return;
    }
    lastResolvedIndustryText.current = industryText;
    setResolvingCustomIndustry(true);
    try {
      const res = await fetch(`/api/intake/${token}/resolve-custom-industry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: industryText,
          businessName: form.businessName,
          otherServices: form.otherServices,
        }),
      });
      if (!res.ok) return;
      const json = await res.json() as { label?: string; services?: string[] };
      if (Array.isArray(json.services) && json.services.length > 0) {
        setCustomIndustryServices(json.services);
      }
      if (json.label && !allIndustryOptions.some((o) => o.toLowerCase() === json.label!.toLowerCase())) {
        setCustomIndustryLabels((prev) => [...prev, json.label!]);
      }
      maybeAutoSuggestCustomers(industryText, form.otherServices);
    } catch {
      // Non-critical — the static catalog examples still show.
    } finally {
      setResolvingCustomIndustry(false);
    }
  };

  const premiumImagesReady =
    intakeTier !== 'ai_premium' ||
    imageSelectionsComplete(imageSelections, studioServices);

  const submitForm = async (overrides?: { themeOverride: string; layoutOverride: string; themeTokensOverride?: ThemeTokenSelection | null }) => {
    if (intakeTier === 'ai_premium' && depositRequiredCents > 0 && depositStatus !== 'paid') {
      setError('Pay the 30% deposit before submitting.');
      return;
    }
    if (intakeTier === 'ai_premium' && !premiumImagesReady) {
      setError('Select hero and product images in the AI studio before submitting.');
      return;
    }

    // Enforce 1,200-word cap client-side
    for (const [slug, content] of Object.entries(form.pageContents)) {
      if (form.pages.includes(slug) && content) {
        const count = content.trim().split(/\s+/).filter(Boolean).length;
        if (count > 1200) {
          const opt = SITE_PAGE_OPTIONS.find((p) => p.slug === slug);
          setError(`The page "${opt?.label || slug}" exceeds the 1,200-word limit (${count} words).`);
          return;
        }
      }
    }

    const serviceList = parseServiceList(form.otherServices);
    if (serviceList.length === 0) {
      setError('List at least one service or job you offer.');
      return;
    }
    const finishLabels = [
      form.finish1Label && { label: form.finish1Label, swatchHex: form.finish1Color },
      form.finish2Label && { label: form.finish2Label, swatchHex: form.finish2Color },
      form.finish3Label && { label: form.finish3Label, swatchHex: form.finish3Color },
    ].filter(Boolean);
    const widgetConfigHintsPayload = {
      industry:
        form.industry?.trim() ||
        (widgetConfigHints as WidgetHintsSnapshot | null)?.industry ||
        undefined,
      services: serviceList,
      otherServices: undefined,
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
      calculatorNotes: form.calculatorNotes || undefined,
      brandColor: form.primaryColorHex || undefined,
      businessName: form.businessName || undefined,
    };
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/intake/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          industry: form.industry,
          services: serviceList,
          otherServices: undefined,
          menuItems: form.menuItems
            .filter((item) => item.name.trim().length > 0)
            .map((item) => ({
              name: item.name.trim(),
              price: parseFloat(item.price) || 0,
              category: item.category.trim() || undefined,
            })),
          widgetConfigHints: widgetConfigHintsPayload,
          logoDataUrl: logoDataUrl || undefined,
          logoUrl: selectedGeneratedLogoUrl || undefined,
          ...(overrides ?? {}),
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

  // Guided step wizard — steps are computed dynamically so conditional
  // sections (page content, AI image studio) only appear as steps when
  // they're actually applicable. Order matches every section already
  // rendered below; nothing is removed, only grouped into steps.
  const steps = useMemo(() => {
    const arr: { key: string; title: string }[] = [
      { key: 'business', title: 'Business & contact' },
      { key: 'services', title: 'Services & pricing' },
    ];
    if (form.pages.length > 0) arr.push({ key: 'pageContent', title: 'Page content' });
    if (canUseImageStudio && studioServices.length > 0) {
      arr.push({ key: 'imageStudio', title: 'AI image studio' });
    }
    arr.push({ key: 'review', title: 'Review & submit' });
    return arr;
  }, [form.pages.length, canUseImageStudio, studioServices.length]);

  const stepIdx = useMemo(() => {
    const map: Record<string, number> = {};
    steps.forEach((s, i) => { map[s.key] = i; });
    return map;
  }, [steps]);

  // Keep the current position valid if a conditional step disappears (e.g.
  // the user removes all extra pages, or the tier no longer includes the
  // image studio) while they're on/past it.
  useEffect(() => {
    setCurrentStepIndex((idx) => Math.min(idx, steps.length - 1));
    setMaxStepIndexVisited((m) => Math.min(m, steps.length - 1));
  }, [steps.length]);

  // Auto-trigger page content generation when the user reaches the step
  useEffect(() => {
    if (currentStepIndex !== stepIdx.pageContent || !stepIdx.pageContent) return;
    if (form.pages.some((slug) => !form.pageContents[slug]?.trim())) {
      void handleGenerateAllPageCopy();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepIndex, stepIdx.pageContent]);



  const businessStepComplete =
    form.businessName.trim().length > 0 &&
    form.contactPhone.trim().length > 0 &&
    form.contactEmail.trim().length > 0;

  const isReviewStep = currentStepIndex === stepIdx.review;
  const canAdvanceFromCurrentStep =
    currentStepIndex === stepIdx.business ? businessStepComplete : true;

  const goToStep = (idx: number) => {
    if (idx < 0 || idx >= steps.length || idx > maxStepIndexVisited) return;
    setCurrentStepIndex(idx);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const goNext = () => {
    if (!canAdvanceFromCurrentStep) return;
    setCurrentStepIndex((idx) => {
      const next = Math.min(idx + 1, steps.length - 1);
      setMaxStepIndexVisited((m) => Math.max(m, next));
      return next;
    });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const goBack = () => {
    setCurrentStepIndex((idx) => Math.max(idx - 1, 0));
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
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
  if (needsEmailVerify) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="mx-auto max-w-md w-full rounded-xl border border-gray-200 bg-white p-8 shadow-sm text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-indigo-100 text-indigo-600 text-2xl">✉</div>
          <h1 className="text-xl font-semibold text-gray-900">Check your email</h1>
          <p className="mt-2 text-sm text-gray-600">
            We sent a confirmation link to <strong>{prospectEmail || 'your email'}</strong>.
            Click that link to unlock your setup form.
          </p>
          <p className="mt-4 text-xs text-gray-400">
            Didn&apos;t get it? Check your spam folder or{' '}
            <a
              href={`/api/intake/public/verify?token=${encodeURIComponent(token)}`}
              className="text-indigo-600 hover:underline"
            >
              click here to verify now
            </a>
            .
          </p>
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
    <div className="min-h-screen bg-[#0a0a0a] px-4 py-6 text-white sm:py-10">
      <div className="mx-auto max-w-3xl">
        {/* Setup package decision only matters on the first step — once the
            contractor has moved on, don't keep re-showing it on every
            subsequent screen. Also skipped entirely when the tier was
            already chosen before they got here (get-started flow or a
            tier-specific email link) — showing the picker again is
            confusing and makes the form feel less clean. */}
        {currentStepIndex === stepIdx.business && tierCatalog.length > 0 && !tierAlreadySelected && (
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

        {currentStepIndex === stepIdx.business && intakeTier === 'ai_premium' && depositRequiredCents > 0 && (
          <div className="mb-8">
            <DepositCTA
              token={token}
              depositRequiredCents={depositRequiredCents}
              depositStatus={depositStatus}
              totalCents={tierTotalCents}
            />
          </div>
        )}

        <div className="mb-5 sm:mb-6">
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Tell us about your business</h1>
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">A few details so we can build your custom website and quote calculator. We&apos;ll walk through it a few steps at a time.</p>
        </div>

        <IntakeStepProgress
          steps={steps}
          currentStepIndex={currentStepIndex}
          maxStepIndexVisited={maxStepIndexVisited}
          onSelect={goToStep}
        />

        {error && !previewResult && (
          <div className="mb-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 sm:mb-6">{error}</div>
        )}

        <div
          className="space-y-6 sm:space-y-8"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
              e.preventDefault();
            }
          }}
        >
          <div className={currentStepIndex === stepIdx.business ? '' : 'hidden'}>
          <section className={sectionClass}>
            <h2 className={sectionTitle}>Business &amp; contact</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
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
                  className={`${input} ${prospectEmail ? 'cursor-not-allowed bg-white/[0.02] text-zinc-500' : ''}`}
                  type="email"
                  required
                  value={form.contactEmail}
                  onChange={(e) => set('contactEmail', e.target.value)}
                  readOnly={!!prospectEmail}
                  disabled={!!prospectEmail}
                />
                {prospectEmail && (
                  <p className="mt-1 text-xs text-zinc-500">
                    This is the email your setup link was sent to and can&apos;t be changed.
                  </p>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Industry / trade</label>
                <select
                  className={selectInput}
                  value={selectedIndustryValue}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === CUSTOM_INDUSTRY_VALUE) {
                      setCustomIndustryMode(true);
                      if (matchedIndustryOption) set('industry', '');
                      return;
                    }
                    setCustomIndustryMode(false);
                    set('industry', value);
                    // Picked a real (catalog or previously-saved custom)
                    // option directly — any stale AI-resolved suggestion from
                    // a prior free-text attempt no longer applies.
                    setCustomIndustryServices(null);
                    lastResolvedIndustryText.current = '';
                    maybeAutoSuggestCustomers(value, form.otherServices);
                  }}
                >
                  <option value="" className={selectOption}>
                    Select your industry…
                  </option>
                  {allIndustryOptions.map((option) => (
                    <option
                      key={option}
                      value={option}
                      className={selectOption}
                    >
                      {option}
                    </option>
                  ))}
                  <option
                    value={CUSTOM_INDUSTRY_VALUE}
                    className={selectOption}
                  >
                    Other (enter custom industry)
                  </option>
                </select>
                {selectedIndustryValue === CUSTOM_INDUSTRY_VALUE && (
                  <>
                    <input
                      className={`${input} mt-2`}
                      value={form.industry}
                      onChange={(e) => set('industry', e.target.value)}
                      onBlur={() => void handleCustomIndustryBlur()}
                      placeholder="Type your industry (e.g. Auto Detailing, Mobile Mechanic)"
                    />
                    {resolvingCustomIndustry && (
                      <p className="mt-1 text-xs text-indigo-600">Finding services for this trade…</p>
                    )}
                  </>
                )}
                <p className="mt-1 text-xs text-zinc-500">
                  {studioServices.length > 0 ? 'Based on your listed services: ' : 'Examples: '}
                  {studioServices.length > 0 ? studioServices.join(' · ') : industryExamples.join(' · ')}
                </p>
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

          <section className={sectionClass}>
            <h2 className={sectionTitle}>Where should new leads go?</h2>
            <p className="mb-4 text-xs text-zinc-500">When a visitor requests a quote, we&apos;ll notify you here. Leave blank to use your business contact above.</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
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
          <section className={sectionClass}>
            <h2 className={sectionTitle}>Brand &amp; look</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={label}>Company logo (optional)</label>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="sr-only"
                  onChange={(e) => onLogo(e.target.files?.[0] || null)}
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/[0.16] bg-white/[0.02] px-4 py-3 text-sm font-medium text-zinc-300 transition-colors hover:border-indigo-300/60 hover:bg-indigo-500/10 hover:text-indigo-100"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  {logoDataUrl ? 'Change Logo' : 'Upload Logo'}
                </button>
                {logoDataUrl && (
                  <button
                    type="button"
                    onClick={() => setLogoPreviewUrl(logoDataUrl)}
                    className="group relative mt-2 inline-block"
                    title="Click to preview larger"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoDataUrl} alt="Logo preview" className="h-12 object-contain" />
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded bg-black/0 text-[10px] font-semibold text-white opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
                      Enlarge
                    </span>
                  </button>
                )}
                {intakeTier === 'ai_premium' && (
                  <div className="mt-3 rounded-xl border border-indigo-300/20 bg-indigo-500/10 p-3">
                    <p className="text-xs text-indigo-100">
                      Optional for AI Premium: generate 3 logo concepts inferred from your listed services.
                    </p>
                    <p className="mt-1 text-xs text-indigo-200">
                      Attempts used: {logoGenAttemptsUsed}/{logoGenMaxAttempts}
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleGenerateLogos()}
                      disabled={generatingLogos || logoGenAttemptsUsed >= logoGenMaxAttempts}
                      className="mt-2 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-slate-200 disabled:opacity-50"
                    >
                      {generatingLogos ? 'Generating 3 logos…' : 'Generate 3 AI logo options'}
                    </button>
                    {logoGenAttemptsUsed >= logoGenMaxAttempts && (
                      <p className="mt-2 text-xs text-zinc-400">
                        You&apos;ve reached the logo generation limit for this intake.
                      </p>
                    )}
                    {generatedLogoUrls.length > 0 && (
                      <>
                        <p className="mt-3 text-xs text-indigo-200">
                          AI picked its top recommendation below — click a different option to change it.
                        </p>
                        <div className="mt-1.5 grid grid-cols-3 gap-2">
                          {generatedLogoUrls.map((url, i) => {
                            const selected = selectedGeneratedLogoUrl === url;
                            return (
                              <div key={url} className="group relative">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedGeneratedLogoUrl(url);
                                    setLogoDataUrl('');
                                  }}
                                  className={`w-full rounded-md border p-1 ${selected ? 'border-indigo-400 ring-2 ring-indigo-300/50' : 'border-white/[0.18]'}`}
                                  title="Select this logo"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={url} alt="Generated logo option" className="h-16 w-full rounded object-contain bg-white" />
                                </button>
                                {i === 0 && (
                                  <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-full bg-indigo-500 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
                                    AI pick
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLogoPreviewUrl(url);
                                  }}
                                  title="Preview larger"
                                  aria-label="Preview larger"
                                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100"
                                >
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16zM11 8v6m-3-3h6" /></svg>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                    {selectedGeneratedLogoUrl && (
                      <p className="mt-2 text-xs font-medium text-emerald-300">AI logo selected for submission.</p>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className={label}>Brand color</label>
                <input className="h-10 w-20 rounded border border-white/[0.15] bg-transparent" type="color" value={form.primaryColorHex} onChange={(e) => set('primaryColorHex', e.target.value)} />
              </div>
            </div>
          </section>
          </div>

          <div className={currentStepIndex === stepIdx.services ? '' : 'hidden'}>
          <section className={sectionClass}>
            <h2 className={sectionTitle}>Services &amp; pricing</h2>
            <label className={label}>Services / jobs you offer</label>
            <p className="mb-2 text-xs text-zinc-500">List the services or jobs you offer, separated by commas. These become your site&apos;s service sections and your quote calculator options.</p>
            <textarea
              className={`${input} min-h-[80px] mb-4`}
              value={form.otherServices}
              onChange={(e) => set('otherServices', e.target.value)}
              onBlur={handleServicesBlur}
              placeholder="e.g. Drain cleaning, Water heater install, Leak repair — or Light towing, Winch-out, Jump start — or Walk-in closets, Garages, Pantries"
            />

            {suggestedServices.length > 0 ? (
              <div className="mb-4 rounded-xl border border-indigo-300/20 bg-indigo-500/10 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-300">
                  Common services for {calculatorGuidance.tradeLabel}
                </p>
                <p className="mt-1 mb-3 text-xs text-indigo-200/80">
                  Tap any service below to add it to your list — click again to remove it.
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestedServices.map((svcLabel) => {
                    const active = selectedServiceLabels.has(svcLabel.toLowerCase());
                    return (
                      <button
                        key={svcLabel}
                        type="button"
                        onClick={() => toggleSuggestedService(svcLabel)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? 'border-indigo-300 bg-indigo-500/30 text-white'
                            : 'border-white/[0.14] bg-white/[0.02] text-zinc-300 hover:border-indigo-300/50 hover:bg-indigo-500/10'
                        }`}
                      >
                        {active ? '✓ ' : '+ '}
                        {svcLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="mb-4 rounded-xl border border-indigo-300/20 bg-indigo-500/10 p-4 text-sm text-indigo-100">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-300">Examples for {calculatorGuidance.tradeLabel}</p>
                <p className="mt-1">Try specific quoteable services like: {calculatorGuidance.serviceExamples.join(', ')}.</p>
              </div>
            )}

            {isOrderBusiness ? (
              <div className="mb-4 rounded-xl border border-purple-300/20 bg-purple-500/10 p-4 text-sm text-purple-100">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-purple-300">Order system detected</p>
                <p className="mt-1">
                  Customers of {calculatorGuidance.tradeLabel.toLowerCase()} businesses browse a menu and place an
                  order, rather than requesting a quote — build your priced menu below instead of a quote calculator.
                </p>
              </div>
            ) : isBookingBusiness ? (
              <div className="mb-4 rounded-xl border border-blue-300/20 bg-blue-500/10 p-4 text-sm text-blue-100">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-300">Booking system detected</p>
                <p className="mt-1">
                  Customers of {calculatorGuidance.tradeLabel.toLowerCase()} businesses schedule appointments or book time slots.
                  Your site will be configured with a booking call-to-action instead of a quote calculator.
                </p>
              </div>
            ) : isTicketBusiness ? (
              <div className="mb-4 rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">Ticketing system detected</p>
                <p className="mt-1">
                  Customers of {calculatorGuidance.tradeLabel.toLowerCase()} businesses purchase tickets for events or entry.
                  Your site will be configured with a ticketing call-to-action instead of a quote calculator.
                </p>
              </div>
            ) : (
              <>
            <label className={label}>How do you price these jobs?</label>
            <div className="mb-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
              {[
                { id: 'linear_ft', label: 'Per unit / size', sub: 'Sq ft, linear ft, hours, rooms, or units' },
                { id: 'fixed', label: 'Flat per job', sub: 'One flat price per service, visit, or install' },
              ].map((opt) => {
                const active = form.pricingModel === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => set('pricingModel', opt.id as Form['pricingModel'])}
                    className={`rounded-xl border p-4 text-left transition-all ${active ? 'border-indigo-300 bg-indigo-500/10' : 'border-white/[0.10] bg-white/[0.02] hover:border-indigo-300/40'}`}
                  >
                    <p className="text-sm font-semibold text-white">{opt.label}</p>
                    <p className="mt-1 text-xs text-zinc-400">{opt.sub}</p>
                  </button>
                );
              })}
            </div>
            <div className="mb-4 rounded-xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm text-amber-100">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">Recommended</p>
              <p className="mt-1">Most {calculatorGuidance.tradeLabel} businesses start with <strong>{calculatorGuidance.recommendedPricingModel === 'fixed' ? 'Flat per job' : calculatorGuidance.recommendedPricingModel === 'base_plus_distance' ? 'Base + distance' : 'Per unit / size'}</strong>.</p>
              <p className="mt-1 text-xs text-amber-200/90">{calculatorGuidance.recommendationReason}</p>
            </div>

            {servicesBlurGuidance && (
              <div className="mb-4 rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
                  Industry + services recommendation
                </p>
                <p className="mt-1">
                  Based on your selected industry and listed services, we recommend{' '}
                  <strong>{pricingModelLabel(servicesBlurGuidance.recommendedPricingModel)}</strong>.
                </p>
                <p className="mt-1 text-xs text-emerald-200/90">{servicesBlurGuidance.recommendationReason}</p>
                <p className="mt-2 text-xs font-semibold text-emerald-200">
                  Applied automatically when you left the services field.
                </p>
              </div>
            )}

            <label className={label}>Tier / package names</label>
            <div className="mb-2 grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
              <input className={input} value={form.tierNameBasic} onChange={(e) => set('tierNameBasic', e.target.value)} placeholder="Basic" />
              <input className={input} value={form.tierNameStandard} onChange={(e) => set('tierNameStandard', e.target.value)} placeholder="Standard" />
              <input className={input} value={form.tierNamePremium} onChange={(e) => set('tierNamePremium', e.target.value)} placeholder="Premium" />
            </div>
            <p className="mb-4 text-xs text-zinc-500">Examples: {calculatorGuidance.tierExamples.join(' / ')}</p>

            {servicesBlurGuidance && servicesBlurGuidance.tierExamples.length >= 3 && (
              <div className="mb-4 rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
                  Suggested tier names
                </p>
                <p className="mt-1">
                  Based on your selected industry and listed services:{' '}
                  <strong>{servicesBlurGuidance.tierExamples[0]}</strong> /{' '}
                  <strong>{servicesBlurGuidance.tierExamples[1]}</strong> /{' '}
                  <strong>{servicesBlurGuidance.tierExamples[2]}</strong>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    set('tierNameBasic', servicesBlurGuidance.tierExamples[0]);
                    set('tierNameStandard', servicesBlurGuidance.tierExamples[1]);
                    set('tierNamePremium', servicesBlurGuidance.tierExamples[2]);
                  }}
                  className="mt-3 rounded-md border border-emerald-300/40 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/10"
                >
                  Apply suggested tier names
                </button>
              </div>
            )}

            <label className={label}>Approximate pricing by tier</label>
            <p className="mb-2 text-xs text-zinc-500">Optional. Leave blank if you want AI to estimate from your trade. Examples: {calculatorGuidance.pricingExamples.join(' · ')}</p>
            <div className="mb-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3">
              <input className={input} type="number" min="0" value={form.seedBasic} onChange={(e) => set('seedBasic', e.target.value)} placeholder={form.pricingModel === 'fixed' ? 'e.g. 249' : 'e.g. 45'} />
              <input className={input} type="number" min="0" value={form.seedStandard} onChange={(e) => set('seedStandard', e.target.value)} placeholder={form.pricingModel === 'fixed' ? 'e.g. 899' : 'e.g. 75'} />
              <input className={input} type="number" min="0" value={form.seedPremium} onChange={(e) => set('seedPremium', e.target.value)} placeholder={form.pricingModel === 'fixed' ? 'e.g. 2200' : 'e.g. 120'} />
            </div>

            <label className={label}>Do you offer different materials, packages, or upgrade levels?</label>
            <div className="mb-3 grid grid-cols-2 gap-2.5 sm:gap-3">
              {[
                { label: 'Yes', value: true },
                { label: 'No', value: false },
              ].map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setBool('hasFinishes', opt.value)}
                  className={`rounded-xl border p-3 text-left text-sm transition-all ${form.hasFinishes === opt.value ? 'border-indigo-300 bg-indigo-500/10 text-white' : 'border-white/[0.10] bg-white/[0.02] text-zinc-400'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {form.hasFinishes && (
              <div className="mb-4 space-y-3">
                {[
                  { labelKey: 'finish1Label' as const, colorKey: 'finish1Color' as const },
                  { labelKey: 'finish2Label' as const, colorKey: 'finish2Color' as const },
                  { labelKey: 'finish3Label' as const, colorKey: 'finish3Color' as const },
                ].map((entry, i) => (
                  <div key={i} className="flex items-center gap-2.5 sm:gap-3">
                    <input type="color" className="h-10 w-11 rounded border border-white/[0.15] bg-transparent sm:w-12" value={form[entry.colorKey]} onChange={(e) => set(entry.colorKey, e.target.value)} />
                    <input className={input} value={form[entry.labelKey]} onChange={(e) => set(entry.labelKey, e.target.value)} placeholder={`Option ${i + 1} name`} />
                  </div>
                ))}
                <p className="text-xs text-zinc-500">Examples: {calculatorGuidance.finishExamples.join(' · ')}</p>
              </div>
            )}

            <label className={label}>Add-ons / upgrades</label>
            <textarea className={`${input} min-h-[72px] mb-2`} value={form.addOnText} onChange={(e) => set('addOnText', e.target.value)} placeholder={calculatorGuidance.addOnExamples.join(', ')} />
            <p className="mb-4 text-xs text-zinc-500">Examples: {calculatorGuidance.addOnExamples.join(' · ')}</p>

            <label className={label}>How should the quote calculator think about these jobs?</label>
            {calculatorGuidance.quoteVariables.length > 0 && (
              <div className="mb-3 rounded-xl border border-indigo-300/20 bg-indigo-500/10 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-300">
                  AI-suggested quote inputs for {calculatorGuidance.tradeLabel}
                </p>
                <p className="mt-1 mb-3 text-xs text-indigo-200/80">
                  These details usually drive the price for this trade. Tap any to add it to your notes below.
                </p>
                <div className="flex flex-wrap gap-2">
                  {calculatorGuidance.quoteVariables.map((variable) => {
                    const active = form.calculatorNotes.toLowerCase().includes(variable.toLowerCase());
                    return (
                      <button
                        key={variable}
                        type="button"
                        onClick={() => toggleQuoteVariable(variable)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? 'border-indigo-300 bg-indigo-500/30 text-white'
                            : 'border-white/[0.14] bg-white/[0.02] text-zinc-300 hover:border-indigo-300/50 hover:bg-indigo-500/10'
                        }`}
                      >
                        {active ? '✓ ' : '+ '}
                        {variable}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <textarea className={`${input} min-h-[90px] mb-2`} value={form.calculatorNotes} onChange={(e) => set('calculatorNotes', e.target.value)} placeholder={calculatorGuidance.calculatorNotesExample} />
            <p className="mb-4 text-xs text-zinc-500">{calculatorGuidance.calculatorNotesPrompt}</p>
              </>
            )}

            {isOrderBusiness && (
              <div className="mb-4">
                <label className={label}>Menu items</label>
                <p className="mb-3 text-xs text-zinc-500">
                  Add each item customers can order, with its price. This becomes your site&apos;s menu and order form.
                </p>
                <div className="space-y-2.5">
                  {form.menuItems.map((item) => (
                    <div key={item.id} className="grid grid-cols-1 gap-2 rounded-xl border border-white/[0.10] bg-white/[0.02] p-3 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-center sm:gap-2.5">
                      <input
                        className={input}
                        value={item.name}
                        onChange={(e) => updateMenuItem(item.id, { name: e.target.value })}
                        placeholder="Item name (e.g. Classic Cheeseburger)"
                      />
                      <div className="relative sm:w-28">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
                        <input
                          className={`${input} pl-6`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.price}
                          onChange={(e) => updateMenuItem(item.id, { price: e.target.value })}
                          placeholder="12.00"
                        />
                      </div>
                      <input
                        className={input}
                        value={item.category}
                        onChange={(e) => updateMenuItem(item.id, { category: e.target.value })}
                        placeholder="Category (e.g. Entrees)"
                      />
                      <button
                        type="button"
                        onClick={() => removeMenuItem(item.id)}
                        className="justify-self-start rounded-md border border-red-400/30 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/10 sm:justify-self-center"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addMenuItem}
                  className="mt-3 rounded-md border border-indigo-300/40 px-4 py-2 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-400/10"
                >
                  + Add menu item
                </button>
                {suggestedServices.length > 0 && form.menuItems.length === 0 && (
                  <p className="mt-3 text-xs text-zinc-500">
                    Tip: common items for {calculatorGuidance.tradeLabel.toLowerCase()} include {suggestedServices.slice(0, 4).join(', ')} — add each as its own priced menu item above.
                  </p>
                )}
              </div>
            )}

            <label className={label}>Pricing details (optional)</label>
            <textarea className={`${input} min-h-[80px]`} value={form.pricingNotes} onChange={(e) => set('pricingNotes', e.target.value)} placeholder="e.g. Most jobs start around $300. Larger projects run $2,000–$8,000. If unsure, leave blank and we'll estimate." />
          </section>
          </div>



          {/* Gallery images — shown when Portfolio / Gallery page is selected */}
          {form.pages.includes('portfolio') && (
            <div className={currentStepIndex === stepIdx.services ? '' : 'hidden'}>
            <section className={sectionClass}>
              <h2 className={sectionTitle}>
                Portfolio / Gallery images
              </h2>
              <p className="mb-4 text-sm text-zinc-400">
                Your gallery page needs real photos of work you&apos;ve done yourself — before &amp; after
                shots, finished installs, happy clients, etc. Without your own project photos we
                cannot configure the Portfolio page.
              </p>

              {/* Count selector */}
              <div className="mb-4 sm:mb-5">
                <label className={label}>How many gallery images would you like to include?</label>
                <select
                  className={`${selectInput} w-40`}
                  value={galleryCount}
                  onChange={(e) => setGalleryCount(Number(e.target.value))}
                >
                  <option value={0} className={selectOption}>No images</option>
                  <option value={1} className={selectOption}>1 image</option>
                  <option value={2} className={selectOption}>2 images</option>
                  {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                    <option key={n} value={n} className={selectOption}>{n} images</option>
                  ))}
                </select>
              </div>

              {/* Bulk upload — select all files at once instead of one slot at a time */}
              {galleryCount > 0 && (
                <div className="mb-4 sm:mb-5">
                  <input
                    ref={bulkGalleryInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    className="sr-only"
                    onChange={(e) => { onBulkGalleryFiles(e.target.files); e.target.value = ''; }}
                  />
                  <button
                    type="button"
                    onClick={() => bulkGalleryInputRef.current?.click()}
                    className="flex items-center gap-2 rounded-lg border-2 border-dashed border-indigo-300/40 bg-indigo-500/10 px-3 py-2.5 text-sm font-medium text-indigo-100 transition-colors hover:border-indigo-300/70 hover:bg-indigo-500/20"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    Upload all {galleryCount} images at once
                  </button>
                  <p className="mt-1 text-xs text-zinc-500">
                    Select multiple photos in one go (hold Ctrl/Cmd or Shift while picking) — they&apos;ll fill
                    Image 1, 2, 3… in order.
                  </p>
                </div>
              )}

              {/* Per-image upload / URL inputs */}
              {galleryCount > 0 ? (
              <div className="space-y-3 sm:space-y-4">
                {Array.from({ length: galleryCount }, (_, i) => {
                  const entry = galleryImages[i] ?? { dataUrl: '', url: '' };
                  const hasContent = !!(entry.dataUrl || entry.url.trim());
                  return (
                    <div key={i} className={`rounded-lg border p-4 ${hasContent ? 'border-indigo-300 bg-indigo-500/10' : 'border-white/[0.14] bg-white/[0.01]'}`}>
                      <p className="mb-3 text-sm font-medium text-zinc-200">
                        Image {i + 1}
                        {hasContent && (
                          <span className="ml-2 text-xs font-normal text-indigo-300">✓ Ready</span>
                        )}
                      </p>
                      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs text-zinc-500">Upload a file</label>
                          <input
                            ref={(el) => { galleryInputRefs.current[i] = el; }}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="sr-only"
                            onChange={(e) => onGalleryFile(i, e.target.files?.[0] ?? null)}
                          />
                          <button
                            type="button"
                            onClick={() => galleryInputRefs.current[i]?.click()}
                            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/[0.16] bg-white/[0.02] px-3 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-indigo-300/60 hover:bg-indigo-500/10 hover:text-indigo-100"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            {entry.dataUrl ? 'Change Image' : 'Upload Image'}
                          </button>
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
                          <label className="mb-1 block text-xs text-zinc-500">
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
              ) : (
                <p className="rounded-md border border-white/[0.14] bg-white/[0.02] px-3 py-2 text-sm text-zinc-400">
                  No gallery images will be included.
                </p>
              )}

              {/* Warning if no images provided */}
              {galleryCount > 0 && galleryImages.slice(0, galleryCount).every((e) => !e.dataUrl && !e.url.trim()) && (
                <p className="mt-4 rounded-md border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                  No gallery images added yet. If you don&apos;t upload any photos we won&apos;t be
                  able to configure your Portfolio page — it will be excluded from your site.
                </p>
              )}
            </section>
            </div>
          )}

          {form.pages.length > 0 && (
            <div className={currentStepIndex === stepIdx.pageContent ? '' : 'hidden'}>
            <section className={sectionClass}>
              <h2 className={sectionTitle}>
                Customize Page Content
              </h2>
              <p className="mb-4 text-sm text-zinc-400">
                Review and customize the sales copy for each of your selected pages. You can write your own or let the AI draft a bespoke version based on your intake information. Each page is limited to 1,200 words.
              </p>

              {/* Bulk AI generation button */}
              {form.pages.some((slug) => !form.pageContents[slug]?.trim()) && (
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={() => void handleGenerateAllPageCopy()}
                    disabled={bulkGenerating}
                    className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-black hover:bg-slate-200 disabled:opacity-60 transition-colors"
                  >
                    {bulkGenerating ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Writing page {bulkProgress.current} of {bulkProgress.total}…
                      </>
                    ) : (
                      <>
                        <span>✨</span>
                        AI Write All Pages
                      </>
                    )}
                  </button>
                  {!bulkGenerating && (
                    <p className="mt-1.5 text-xs text-zinc-500">
                      Generates AI copy for all pages that are currently empty.
                    </p>
                  )}
                </div>
              )}

            <div className={`relative ${bulkGenerating ? 'pointer-events-none' : ''}`}>
              {bulkGenerating && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-zinc-900/60 backdrop-blur-[2px]">
                  <div className="flex flex-col items-center justify-center gap-3 text-center">
                    <svg className="h-8 w-8 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <p className="font-semibold text-white">AI is writing your pages...</p>
                    <p className="text-sm text-indigo-200">
                      Writing page {bulkProgress.current} of {bulkProgress.total}
                    </p>
                  </div>
                </div>
              )}
              
              <div className="space-y-4">
                {form.pages.map((slug) => {
                  const opt = SITE_PAGE_OPTIONS.find((p) => p.slug === slug);
                  const label = opt?.label || slug;
                  const desc = opt?.description || '';
                  const content = form.pageContents[slug] || '';
                  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
                  const isExpanded = expandedPage === slug;
                  const isGenerating = !!generatingCopy[slug];
                  const isOverLimit = wordCount > 1200;

                  return (
                    <div
                      key={slug}
                      className={`rounded-lg border transition-all ${
                        isExpanded ? 'border-indigo-400 ring-1 ring-indigo-400 bg-white/[0.04]' : 'border-white/[0.14] bg-white/[0.01]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedPage(isExpanded ? null : slug)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left font-medium text-zinc-100 focus:outline-none"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{label}</span>
                          {content && (
                            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                              Has Content
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs ${isOverLimit ? 'font-bold text-red-400' : 'text-zinc-500'}`}>
                            {wordCount} / 1,200 words
                          </span>
                          <svg
                            className={`h-5 w-5 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-white/[0.08] px-3.5 pb-3.5 pt-3 sm:px-4 sm:pb-4">
                          <p className="mb-3 text-xs text-zinc-500">{desc}</p>
                          <div className="relative">
                            <textarea
                              className={`w-full min-h-[180px] rounded-xl border p-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-white/30 sm:min-h-[200px] ${
                                isOverLimit ? 'border-red-400/70 focus:border-red-400' : 'border-white/[0.14] bg-white/[0.02]'
                              }`}
                              value={content}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  pageContents: {
                                    ...f.pageContents,
                                    [slug]: e.target.value,
                                  },
                                }))
                              }
                              placeholder={`Enter the body copy for your ${label} page...`}
                              disabled={isGenerating}
                            />
                            {isGenerating && (
                              <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/45">
                                <div className="flex flex-col items-center gap-2">
                                  <svg className="animate-spin h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                  <span className="text-xs font-medium text-zinc-200">AI is drafting copy...</span>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="mt-3 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() => void handleGeneratePageCopy(slug)}
                              disabled={isGenerating}
                              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-500/15 px-3 py-1.5 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/25 disabled:opacity-50"
                            >
                              <span>✨</span>
                              {content ? 'AI Rewrite Copy' : 'AI Write Copy'}
                            </button>
                            {isOverLimit && (
                              <span className="animate-pulse text-xs font-semibold text-red-400">
                                Exceeds 1,200-word limit. Please shorten.
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            </section>
          </div>
          )}

          {canUseImageStudio && studioServices.length > 0 && (
            <div className={currentStepIndex === stepIdx.imageStudio ? '' : 'hidden'}>
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
              formState={form}
              isActive={currentStepIndex === stepIdx.imageStudio}
            />
            </div>
          )}

          <div className={isReviewStep ? '' : 'hidden'}>
          {intakeTier === 'ai_premium' && canUseImageStudio && !premiumImagesReady && (
            <p className="text-sm text-amber-800 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
              Complete the AI image studio (hero + each service) before submitting.
            </p>
          )}

          {error && <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

          {/* Step 1: Review & Submit button — opens the presentation review panel */}
          {!previewResult && (
            <button
              type="button"
              disabled={submitting || (intakeTier === 'ai_premium' && !premiumImagesReady)}
              onClick={() => void handleReviewClick()}
              className="w-full rounded-xl bg-white px-5 py-3 font-bold text-black hover:bg-slate-200 disabled:opacity-50 sm:px-6"
            >
              {submitting ? 'Previewing…' : 'Review & Submit →'}
            </button>
          )}

          {/* Step 2: Presentation review panel */}
          {previewResult && (
            <div ref={reviewRef}>
              <PresentationReviewStep
                aiTheme={previewResult.theme}
                aiLayout={previewResult.layoutStyle}
                selectedTheme={pendingTheme}
                selectedLayout={pendingLayout}
                allowedThemes={previewResult.allowedThemes}
                allowedLayouts={previewResult.allowedLayouts}
                themeTokens={previewResult.themeTokens}
                isSynthesized={!!previewResult.isSynthesized}
                isAdmin={isAdmin}
                onThemeChange={setPendingTheme}
                onLayoutChange={setPendingLayout}
                onBack={() => { setPreviewResult(null); setError(''); }}
                onConfirm={() => void submitForm({
                  themeOverride: pendingTheme,
                  layoutOverride: pendingLayout,
                  // Only carry the synthesized look forward if the user kept
                  // the AI-suggested theme; picking a different real theme
                  // means they want that theme's authentic hand-tuned style.
                  themeTokensOverride:
                    previewResult.isSynthesized && pendingTheme === previewResult.theme
                      ? previewResult.themeTokens
                      : undefined,
                })}
                submitting={submitting}
                error={error}
              />
            </div>
          )}
          </div>

          {!isReviewStep && (
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={goBack}
                disabled={currentStepIndex === 0}
                className="rounded-xl border border-white/[0.14] px-5 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-40 sm:px-6"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={!canAdvanceFromCurrentStep}
                className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50 sm:px-6"
              >
                Continue →
              </button>
            </div>
          )}
        </div>
      </div>

      {logoPreviewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setLogoPreviewUrl(null)}
        >
          <div
            className="flex max-h-[90vh] w-auto flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rounded-lg bg-white p-6 shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoPreviewUrl}
                alt="Logo preview (large)"
                className="object-contain"
                style={{ width: '60vw', maxWidth: '520px', maxHeight: '70vh' }}
              />
            </div>
            <button
              type="button"
              onClick={() => setLogoPreviewUrl(null)}
              className="rounded-md border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

