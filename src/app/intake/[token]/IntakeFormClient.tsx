'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { IntakeTierCatalogEntry } from '@/lib/intake/tiers';
import type { IntakeCheckoutKind } from '@/lib/intake/intakePaymentStage';
import { startIntakeCheckout } from '@/lib/intake/startIntakeCheckout';
import {
  beforeAfterSelectionComplete,
  imageSelectionsComplete,
  type IntakeImageSelections,
} from '@/lib/intake/imageSelections';
import TierPicker from './TierPicker';
import DepositCTA from './DepositCTA';
import PayToLaunchBlock from './PayToLaunchBlock';
import IntakeImageStudio from './IntakeImageStudio';
import DomainSuggestPicker from '@/components/DomainSuggestPicker';

import { guidanceFromCustomIndustry, inferQuoteCalculatorGuidance } from '@/lib/quoteCalculatorGuidance';
import type { QuoteCalculatorGuidance } from '@/lib/quoteCalculatorGuidance';
import {
  SITE_PAGE_OPTIONS,
  RECOMMENDED_PAGE_SLUGS,
  sanitizePageSlugs,
  clampPagesForTier,
  maxPagesForTier,
  maxAdditionalPagesForTier,
} from '@/lib/catalog/sitePages';
import { listIndustries, resolveIndustrySlug, getIndustry, getEngagementModel, isLowConfidenceResolution } from '@/lib/catalog/serviceCatalog';
import { getBeforeAfterCategory } from '@/lib/images/beforeAfterPrompt';

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
  /** Opt-in: platform buys desiredDomain after provision (admin). Default false = BYO. */
  domainPurchaseRequested: boolean;
  /** Opt-in: homepage lead quiz. Default false. */
  includeQuiz: boolean;
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
  /** Server-resolved (includes custom industries). Prefer over client catalog guess. */
  beforeAfterApplicable?: boolean;
  pageContents?: Record<string, string>;
  initialGalleryImages?: string[];
  initialTierFromQuery?: string;
  payKindFromQuery?: IntakeCheckoutKind;
  paymentDueLabel?: string;
  paymentCheckoutKind?: IntakeCheckoutKind | null;
  canPayToLaunch?: boolean;
  paymentAmountCents?: number;
  /** Server-persisted opt-in for homepage lead quiz. */
  includeQuiz?: boolean;
};

function emptyForm(
  businessName: string,
  contactEmail = '',
  pages: string[] = [],
  pageContents?: Record<string, string>,
  widgetHints?: WidgetHintsSnapshot | null,
  includeQuiz = false
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
    domainPurchaseRequested: false,
    includeQuiz: includeQuiz === true,
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
  beforeAfterApplicable: initialBeforeAfterApplicable,
  pageContents,
  initialGalleryImages,
  initialTierFromQuery,
  payKindFromQuery,
  paymentDueLabel: initialPaymentDueLabel = '',
  paymentCheckoutKind: initialPaymentCheckoutKind = null,
  canPayToLaunch: initialCanPayToLaunch = false,
  paymentAmountCents: initialPaymentAmountCents = 0,
  includeQuiz: initialIncludeQuiz = false,
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
      widgetConfigHints as WidgetHintsSnapshot | null,
      initialIncludeQuiz
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
  const [customIndustryLabels, setCustomIndustryLabels] = useState<string[]>([]);
  const [customIndustryServices, setCustomIndustryServices] = useState<string[] | null>(null);
  const [customIndustryGuidance, setCustomIndustryGuidance] = useState<QuoteCalculatorGuidance | null>(null);
  const [customIndustryEngagement, setCustomIndustryEngagement] = useState<
    'quote' | 'order' | 'booking' | 'ticket' | null
  >(null);
  const [resolvingCustomIndustry, setResolvingCustomIndustry] = useState(false);
  const lastResolvedIndustryText = useRef<string>('');
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
  const [suggestingPages, setSuggestingPages] = useState(false);
  const [suggestedPages, setSuggestedPages] = useState<Array<{ slug: string; label: string; description: string }>>([]);
  /** Gate: AI page copy must not run until the user confirms page selection is done. */
  const [pagesSelectionConfirmed, setPagesSelectionConfirmed] = useState(false);
  /** Labels from AI-recommended pages that were added as Services offerings. */
  const [addedAiServiceLabels, setAddedAiServiceLabels] = useState<string[]>([]);
  const [servicesBlurGuidance, setServicesBlurGuidance] = useState<ReturnType<
    typeof inferQuoteCalculatorGuidance
  > | null>(null);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [maxStepIndexVisited, setMaxStepIndexVisited] = useState(0);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  type GalleryEntry = { dataUrl: string; url: string };
  const [galleryCount, setGalleryCount] = useState(initialGalleryImages?.length ? Math.max(5, initialGalleryImages.length) : 5);
  const [galleryImages, setGalleryImages] = useState<GalleryEntry[]>(() => {
    const defaultEntries = Array.from({ length: 10 }, () => ({ dataUrl: '', url: '' }));
    if (initialGalleryImages && initialGalleryImages.length > 0) {
      initialGalleryImages.forEach((url, i) => {
        if (i < defaultEntries.length) {
          defaultEntries[i] = { dataUrl: '', url };
        }
      });
    }
    return defaultEntries;
  });

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

  useEffect(() => {
    let cancelled = false;
    fetch('/api/catalog/custom-industries')
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { industries?: Array<{ label: string }> } | null) => {
        if (cancelled || !json?.industries) return;
        setCustomIndustryLabels(json.industries.map((i) => i.label).filter(Boolean));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

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
    }
    draftRestored.current = true;
  }, [draftKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !draftRestored.current || submitted) return;
    try {
      window.localStorage.setItem(
        draftKey,
        JSON.stringify(buildDraftSnapshot(form, selectedGeneratedLogoUrl, currentStepIndex))
      );
    } catch {
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

  // After email verification (or returning from a verify link), refetch intake
  // so healed tier/deposit state is applied client-side before AI features run.
  const intakeRefetchDone = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined' || intakeRefetchDone.current || submitted) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('verified') !== '1') return;
    intakeRefetchDone.current = true;
    fetch(`/api/intake/${token}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) return;
        if (json.intakeTier) setIntakeTier(json.intakeTier);
        if (json.depositStatus) setDepositStatus(json.depositStatus);
        if (typeof json.canUseImageStudio === 'boolean') {
          setCanUseImageStudio(json.canUseImageStudio);
        }
      })
      .catch(() => {});
  }, [submitted, token]);

  useEffect(() => {
    if (payAutoDone.current || !payKindFromQuery || !canPayToLaunch) return;
    payAutoDone.current = true;
    void startIntakeCheckout(token, payKindFromQuery);
  }, [payKindFromQuery, canPayToLaunch, token]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setBool = <K extends keyof Form>(key: K, value: boolean) =>
    setForm((f) => ({ ...f, [key]: value as Form[K] }));

  const maxExtraPages = maxAdditionalPagesForTier(intakeTier);
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

  const suggestCustomersKey = (industryText: string, servicesText: string) => {
    const services = parseServiceList(servicesText)
      .map((s) => s.toLowerCase())
      .sort()
      .join(',');
    return `${industryText.trim().toLowerCase()}|${services}`;
  };

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
      } finally {
        setGeneratingCopy((prev) => ({ ...prev, [slug]: false }));
      }
    }
    setBulkGenerating(false);
  }, [form, token, handleGeneratePageCopy]);

  const handleSuggestPages = async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    setSuggestingPages(true);
    if (!silent) setError('');
    try {
      const res = await fetch(`/api/intake/${token}/suggest-pages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: form.industry,
          services: form.services,
          otherServices: form.otherServices,
          businessName: form.businessName,
          pricingModel: form.pricingModel,
          serviceArea: form.serviceArea,
          vibe: form.vibe,
          tone: form.tone,
          customers: form.customers,
          experience: form.experience,
          primaryCta: form.primaryCta,
          differentiators: form.differentiators,
          pricingNotes: form.pricingNotes,
          notes: form.notes,
          existingPages: form.pages,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to suggest pages');
      if (Array.isArray(json.suggestions)) {
        setSuggestedPages(json.suggestions);
      }
    } catch (err) {
      // Auto-fetch failures stay quiet — the prospect can still pick pages
      // manually and hit "Suggest pages" to retry.
      if (!silent) setError(err instanceof Error ? err.message : 'Failed to suggest pages');
    } finally {
      setSuggestingPages(false);
    }
  };

  const pageCap = maxAdditionalPagesForTier(
    intakeTier === 'ai_premium' ? 'ai_premium' : 'standard'
  );

  /** AI recommendations become Services offerings — not separate top-level pages. */
  const handleAddSuggestedPage = (suggestion: { slug: string; label: string; description: string }) => {
    const label = suggestion.label.trim();
    if (!label) return;

    setForm((f) => {
      const pages = f.pages.includes('services')
        ? f.pages
        : f.pages.length >= pageCap
          ? f.pages
          : [...f.pages, 'services'];
      const already =
        f.services.some((s) => s.toLowerCase() === label.toLowerCase()) ||
        f.otherServices
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .some((s) => s.toLowerCase() === label.toLowerCase());
      if (already) return { ...f, pages };

      const extras = f.otherServices
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      extras.push(label);
      // Clear Services copy so the next confirm regenerates with the new offerings.
      const { services: _servicesCopy, ...restContents } = f.pageContents;
      return {
        ...f,
        pages,
        otherServices: extras.join(', '),
        pageContents: restContents,
      };
    });
    setSuggestedPages((prev) => prev.filter((s) => s.slug !== suggestion.slug));
    setAddedAiServiceLabels((prev) =>
      prev.some((l) => l.toLowerCase() === label.toLowerCase()) ? prev : [...prev, label]
    );
    setPagesSelectionConfirmed(false);
  };

  const handleRemoveAiServiceOffering = (label: string) => {
    setAddedAiServiceLabels((prev) => prev.filter((l) => l !== label));
    setForm((f) => {
      const extras = f.otherServices
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((s) => s.toLowerCase() !== label.toLowerCase());
      const { services: _servicesCopy, ...restContents } = f.pageContents;
      return { ...f, otherServices: extras.join(', '), pageContents: restContents };
    });
    setPagesSelectionConfirmed(false);
  };

  const handleConfirmPagesSelection = async () => {
    if (form.pages.length === 0) return;
    setPagesSelectionConfirmed(true);
    const missing = form.pages.filter((slug) => !(form.pageContents[slug] || '').trim());
    if (missing.length > 0) {
      await handleGenerateAllPageCopy();
    }
  };

  const handleRemovePage = (slug: string) => {
    setForm((f) => ({ ...f, pages: f.pages.filter((p) => p !== slug) }));
  };

  // Toggle a standard catalog page on/off, respecting the tier's page cap.
  const handleTogglePage = (slug: string) => {
    setForm((f) => {
      if (f.pages.includes(slug)) {
        return { ...f, pages: f.pages.filter((p) => p !== slug) };
      }
      if (f.pages.length >= pageCap) return f;
      return { ...f, pages: [...f.pages, slug] };
    });
  };

  const collectServicesForSubmit = (): string[] => {
    const fromOther = parseServiceList(form.otherServices);
    const fromCheckboxes = form.services || [];
    const listed = [...fromCheckboxes, ...fromOther];
    if (listed.length > 0) return listed;
    // Custom industry catalog services (e.g. "Entertainment Service") when the
    // prospect never typed into the free-text field but the industry is known.
    if (customIndustryServices && customIndustryServices.length > 0) {
      return customIndustryServices;
    }
    return [];
  };

  const handleReviewClick = async () => {
    const serviceList = collectServicesForSubmit();
    if (serviceList.length === 0) {
      setError('List at least one service or job you offer.');
      if (stepIdx.services >= 0) {
        setCurrentStepIndex(stepIdx.services);
        setMaxStepIndexVisited((m) => Math.max(m, stepIdx.services));
      }
      return;
    }
    if (!form.otherServices.trim() && serviceList.length > 0) {
      set('otherServices', serviceList.join(', '));
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
    void submitForm();
  };

  /** Real services the contractor listed — never invent the industry name as a
   *  service (that made "Entertainment" match closet "Entertainment & Media Centers"). */
  const listedServices = useMemo(() => {
    const fromOther = parseServiceList(form.otherServices);
    const fromCheckboxes = form.services || [];
    return [...fromCheckboxes, ...fromOther];
  }, [form.services, form.otherServices]);

  /** Image studio still needs at least one label when services are empty. */
  const studioServices = useMemo(() => {
    if (listedServices.length > 0) return listedServices;
    if (form.industry.trim()) return [form.industry.trim()];
    return [];
  }, [listedServices, form.industry]);

  const isOrderBusiness = useMemo(() => {
    if (customIndustryEngagement) return customIndustryEngagement === 'order';
    const industryText =
      form.industry.trim() || (widgetConfigHints as WidgetHintsSnapshot | null)?.industry || '';
    if (!industryText.trim() && listedServices.length === 0) return false;
    const slug = resolveIndustrySlug({ industry: industryText, services: listedServices });
    return getEngagementModel(slug) === 'order';
  }, [form.industry, listedServices, widgetConfigHints, customIndustryEngagement]);

  const isBookingBusiness = useMemo(() => {
    if (customIndustryEngagement) return customIndustryEngagement === 'booking';
    const industryText =
      form.industry.trim() || (widgetConfigHints as WidgetHintsSnapshot | null)?.industry || '';
    if (!industryText.trim() && listedServices.length === 0) return false;
    const slug = resolveIndustrySlug({ industry: industryText, services: listedServices });
    return getEngagementModel(slug) === 'booking';
  }, [form.industry, listedServices, widgetConfigHints, customIndustryEngagement]);

  const isTicketBusiness = useMemo(() => {
    if (customIndustryEngagement) return customIndustryEngagement === 'ticket';
    const industryText =
      form.industry.trim() || (widgetConfigHints as WidgetHintsSnapshot | null)?.industry || '';
    if (!industryText.trim() && listedServices.length === 0) return false;
    const slug = resolveIndustrySlug({ industry: industryText, services: listedServices });
    return getEngagementModel(slug) === 'ticket';
  }, [form.industry, listedServices, widgetConfigHints, customIndustryEngagement]);

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

  const calculatorGuidance = useMemo(() => {
    if (customIndustryGuidance) return customIndustryGuidance;
    return inferQuoteCalculatorGuidance({
      industry:
        form.industry ||
        (widgetConfigHints as WidgetHintsSnapshot | null)?.industry,
      servicesText: form.otherServices,
      services: listedServices,
    });
  }, [
    customIndustryGuidance,
    form.industry,
    form.otherServices,
    listedServices,
    widgetConfigHints,
  ]);

  const applyServicesGuidance = (servicesText: string) => {
    const industry = form.industry.trim();
    maybeAutoSuggestCustomers(industry, servicesText);
    const services = parseServiceList(servicesText);
    if (!industry || services.length === 0) {
      setServicesBlurGuidance(null);
      return;
    }
    if (customIndustryGuidance) {
      setServicesBlurGuidance(customIndustryGuidance);
      set(
        'pricingModel',
        customIndustryGuidance.recommendedPricingModel === 'linear_ft' ? 'linear_ft' : 'fixed'
      );
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

  // When a custom industry resolves with catalog services and the prospect left
  // the free-text field empty, seed it so submit/studio stay in sync.
  const seededCustomServicesRef = useRef<string | null>(null);
  useEffect(() => {
    if (!customIndustryServices || customIndustryServices.length === 0) return;
    if (form.otherServices.trim() || (form.services || []).length > 0) return;
    const key = `${form.industry}::${customIndustryServices.join('|')}`;
    if (seededCustomServicesRef.current === key) return;
    seededCustomServicesRef.current = key;
    set('otherServices', customIndustryServices.join(', '));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once per industry/services pair
  }, [customIndustryServices, form.industry, form.otherServices, form.services]);

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

  // Tap-to-add a suggested add-on into the comma-separated add-ons field.
  const toggleAddOn = (addOn: string) => {
    const current = parseServiceList(form.addOnText);
    const exists = current.some((s) => s.toLowerCase() === addOn.toLowerCase());
    const next = exists
      ? current.filter((s) => s.toLowerCase() !== addOn.toLowerCase())
      : [...current, addOn];
    set('addOnText', next.join(', '));
  };

  const industryExamples = useMemo(
    () => industryExampleLabels(calculatorGuidance.tradeLabel),
    [calculatorGuidance.tradeLabel]
  );
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
  const [customIndustryMode, setCustomIndustryMode] = useState(false);
  const selectedIndustryValue =
    customIndustryMode || (form.industry.trim() && !matchedIndustryOption)
      ? CUSTOM_INDUSTRY_VALUE
      : matchedIndustryOption || '';

  const applyResolvedCustomIndustry = (json: {
    label?: string
    services?: string[]
    engagementModel?: string
    isCustom?: boolean
  }) => {
    const services = Array.isArray(json.services) ? json.services.filter(Boolean) : []
    if (services.length > 0) setCustomIndustryServices(services)
    const engagement =
      json.engagementModel === 'order' ||
      json.engagementModel === 'booking' ||
      json.engagementModel === 'ticket' ||
      json.engagementModel === 'quote'
        ? json.engagementModel
        : 'quote'
    if (json.isCustom) {
      setCustomIndustryEngagement(engagement)
      const guidance = guidanceFromCustomIndustry({
        label: json.label || form.industry,
        services,
        engagementModel: engagement,
      })
      setCustomIndustryGuidance(guidance)
      setServicesBlurGuidance(guidance)
      set(
        'pricingModel',
        guidance.recommendedPricingModel === 'linear_ft' ? 'linear_ft' : 'fixed'
      )
    } else {
      setCustomIndustryEngagement(null)
      setCustomIndustryGuidance(null)
      if (services.length === 0) setCustomIndustryServices(null)
    }
    if (json.label) {
      setCustomIndustryLabels((prev) =>
        prev.some((o) => o.toLowerCase() === json.label!.toLowerCase())
          ? prev
          : [...prev, json.label!]
      )
    }
  }

  const resolveIndustryForGuidance = async (industryText: string) => {
    const trimmed = industryText.trim()
    if (!trimmed || trimmed.length < 3) return
    if (trimmed === lastResolvedIndustryText.current) return
    lastResolvedIndustryText.current = trimmed
    setResolvingCustomIndustry(true)
    try {
      const res = await fetch(`/api/intake/${token}/resolve-custom-industry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: trimmed,
          businessName: form.businessName,
          otherServices: form.otherServices,
        }),
      })
      if (!res.ok) return
      const json = (await res.json()) as {
        label?: string
        services?: string[]
        engagementModel?: string
        isCustom?: boolean
        source?: string
      }
      // Catalog hits still return services — use them, but don't keep a custom override.
      if (json.isCustom) {
        applyResolvedCustomIndustry({ ...json, isCustom: true })
      } else {
        setCustomIndustryGuidance(null)
        setCustomIndustryEngagement(null)
        if (Array.isArray(json.services) && json.services.length > 0) {
          setCustomIndustryServices(json.services)
        } else {
          setCustomIndustryServices(null)
        }
      }
      maybeAutoSuggestCustomers(trimmed, form.otherServices)
    } catch {
      /* ignore */
    } finally {
      setResolvingCustomIndustry(false)
    }
  }

  const handleCustomIndustryBlur = async () => {
    const industryText = form.industry.trim();
    if (!industryText || industryText.length < 3) return;
    // Always resolve — including when the label already appears in the dropdown
    // (prior custom industries). Skipping matched labels left guidance stuck on
    // closets defaults.
    await resolveIndustryForGuidance(industryText);
  };

  // When industry is chosen from the dropdown (including prior custom labels),
  // resolve guidance. Free-text "Other" typing resolves on blur only — avoid
  // calling Gemini on every keystroke.
  useEffect(() => {
    const industryText = form.industry.trim();
    if (!industryText || industryText.length < 3) return;
    if (customIndustryMode) return;
    if (industryText === lastResolvedIndustryText.current) return;
    void resolveIndustryForGuidance(industryText);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- industry / mode only
  }, [form.industry, customIndustryMode]);

  const beforeAfterApplicableForSubmit =
    typeof initialBeforeAfterApplicable === 'boolean'
      ? initialBeforeAfterApplicable
      : getBeforeAfterCategory(
          resolveIndustrySlug({
            industry: form.industry || null,
            services: studioServices,
            other_services: form.otherServices || null,
          })
        ) !== 'not-applicable';

  // If they already opted in, require completion even when the industry catalog
  // says not-applicable (custom-industry mismatch / explicit yes).
  const beforeAfterRequired =
    beforeAfterApplicableForSubmit || imageSelections.beforeAfter?.enabled === true;

  const premiumImagesReady =
    intakeTier !== 'ai_premium' ||
    (imageSelectionsComplete(imageSelections, studioServices) &&
      beforeAfterSelectionComplete(imageSelections, beforeAfterRequired));

  const submitForm = async (overrides?: { themeOverride: string; layoutOverride: string; themeTokensOverride?: any }) => {
    if (intakeTier === 'ai_premium' && depositRequiredCents > 0 && depositStatus !== 'paid') {
      setError('Pay the 30% deposit before submitting.');
      return;
    }
    if (intakeTier === 'ai_premium' && !premiumImagesReady) {
      setError('Select hero and product images in the AI studio before submitting.');
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

    const serviceList = collectServicesForSubmit();
    if (serviceList.length === 0) {
      setError('List at least one service or job you offer.');
      if (stepIdx.services >= 0) {
        setCurrentStepIndex(stepIdx.services);
        setMaxStepIndexVisited((m) => Math.max(m, stepIdx.services));
      }
      return;
    }
    if (!form.otherServices.trim()) {
      set('otherServices', serviceList.join(', '));
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
          galleryImages: galleryImages.slice(0, galleryCount).map(({ dataUrl, url }) => ({
                ...(dataUrl ? { dataUrl } : {}),
                ...(url.trim() ? { url: url.trim() } : {}),
              })),
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
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const steps = useMemo(() => {
    const arr: { key: string; title: string }[] = [
      { key: 'business', title: 'Business & contact' },
      { key: 'domain', title: 'Website domain' },
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

  useEffect(() => {
    setCurrentStepIndex((idx) => Math.min(idx, steps.length - 1));
    setMaxStepIndexVisited((m) => Math.min(m, steps.length - 1));
  }, [steps.length]);

  // Auto-load trade-specific page suggestions the first time the prospect lands
  // on the Page Content step (selection only — copy generation waits for confirm).
  const pageSuggestFetchedRef = useRef(false);
  useEffect(() => {
    if (currentStepIndex !== stepIdx.pageContent || !stepIdx.pageContent) return;
    if (pageSuggestFetchedRef.current) return;
    if (!form.industry && form.services.length === 0) return;
    pageSuggestFetchedRef.current = true;
    void handleSuggestPages({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepIndex, stepIdx.pageContent]);

  // Changing catalog pages after confirm requires a fresh confirm before generation.
  const pagesSelectionKey = form.pages.join('|');
  const pagesSelectionKeyPrev = useRef(pagesSelectionKey);
  useEffect(() => {
    if (pagesSelectionKeyPrev.current === pagesSelectionKey) return;
    pagesSelectionKeyPrev.current = pagesSelectionKey;
    setPagesSelectionConfirmed(false);
  }, [pagesSelectionKey]);

  const businessStepComplete =
    form.businessName.trim().length > 0 &&
    form.contactPhone.trim().length > 0 &&
    form.contactEmail.trim().length > 0;

  const isLastStep = currentStepIndex === steps.length - 1;

  const canAdvanceFromCurrentStep =
    currentStepIndex === stepIdx.business
      ? businessStepComplete
      : currentStepIndex === stepIdx.pageContent
        ? form.pages.length === 0 || pagesSelectionConfirmed
        : true;

  const goToStep = (idx: number) => {
    if (idx < 0 || idx >= steps.length || idx > maxStepIndexVisited) return;
    setCurrentStepIndex(idx);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const goNext = () => {
    if (!canAdvanceFromCurrentStep) return;
    if (currentStepIndex === stepIdx.services) {
      const serviceList = collectServicesForSubmit();
      if (serviceList.length === 0) {
        setError('List at least one service or job you offer.');
        return;
      }
      if (!form.otherServices.trim()) {
        set('otherServices', serviceList.join(', '));
      }
    }
    setError('');
    setCurrentStepIndex((idx) => {
      const next = Math.min(idx + 1, steps.length - 1);
      setMaxStepIndexVisited((m) => Math.max(m, next));
      return next;
    });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const goBack = () => {
    setError('');
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

        {error && (
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
                      setCustomIndustryServices(null);
                      setCustomIndustryGuidance(null);
                      setCustomIndustryEngagement(null);
                      lastResolvedIndustryText.current = '';
                      return;
                    }
                    setCustomIndustryMode(false);
                    set('industry', value);
                    setCustomIndustryServices(null);
                    setCustomIndustryGuidance(null);
                    setCustomIndustryEngagement(null);
                    setServicesBlurGuidance(null);
                    lastResolvedIndustryText.current = '';
                    maybeAutoSuggestCustomers(value, form.otherServices);
                    void resolveIndustryForGuidance(value);
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
                  {listedServices.length > 0 ? 'Based on your listed services: ' : 'Examples: '}
                  {listedServices.length > 0 ? listedServices.join(' · ') : industryExamples.join(' · ')}
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

          <div className={currentStepIndex === stepIdx.domain ? '' : 'hidden'}>
            <section className={sectionClass}>
              <h2 className={sectionTitle}>Website domain</h2>
              <p className="mb-3 text-sm text-zinc-400">
                Prefer a domain you already own (GoDaddy, Namecheap, Cloudflare, Hostinger, etc.).
                After your site is built, you&apos;ll connect it with simple DNS records — you keep
                ownership. Need us to buy one for you? Check the box below and pick an available
                name.
              </p>
              <div className="mb-4">
                <label className={label}>Domain you already own (recommended)</label>
                <input
                  className={input}
                  placeholder="example.com"
                  value={form.desiredDomain}
                  onChange={(e) => {
                    set('desiredDomain', e.target.value.trim().toLowerCase())
                    if (form.domainPurchaseRequested) set('domainPurchaseRequested', false)
                  }}
                  disabled={form.domainPurchaseRequested}
                />
                <p className="mt-1.5 text-xs text-zinc-500">
                  Leave blank to use a free subdomain for now; you can connect a custom domain later.
                </p>
              </div>

              <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.12] bg-white/[0.03] p-4">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent text-indigo-500"
                  checked={form.domainPurchaseRequested}
                  onChange={(e) => {
                    const on = e.target.checked
                    set('domainPurchaseRequested', on)
                    if (!on) {
                      /* keep desiredDomain so BYO field still shows their pick */
                    }
                  }}
                />
                <span>
                  <span className="block text-sm font-medium text-zinc-100">
                    I want you to purchase my domain and set it up for me
                  </span>
                  <span className="mt-1 block text-xs text-zinc-500">
                    We&apos;ll register an available .com / .net / .io after your site is built
                    (included with hosting). You won&apos;t leave this form to buy elsewhere.
                  </span>
                </span>
              </label>

              {form.domainPurchaseRequested && (
                <div>
                  <label className={label}>Find an available domain</label>
                  <DomainSuggestPicker
                    mode="intake"
                    intakeToken={token}
                    businessNameHint={form.businessName}
                    value={form.desiredDomain}
                    onChange={(domain) => set('desiredDomain', domain)}
                    variant="light"
                  />
                </div>
              )}

              {!form.domainPurchaseRequested && form.desiredDomain && (
                <p className="mt-3 text-xs text-sky-300/90 rounded-lg border border-sky-400/20 bg-sky-500/10 px-3 py-2">
                  After launch you&apos;ll get step-by-step DNS instructions for GoDaddy, Namecheap,
                  Cloudflare, Hostinger, and others to point <strong>{form.desiredDomain}</strong>{' '}
                  at your new site.
                </p>
              )}
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
              onChange={(e) => {
                setError('');
                set('otherServices', e.target.value);
              }}
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
            {calculatorGuidance.addOnExamples.length > 0 && (
              <div className="mb-3 rounded-xl border border-indigo-300/20 bg-indigo-500/10 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-300">
                  AI-suggested add-ons for {calculatorGuidance.tradeLabel}
                </p>
                <p className="mt-1 mb-3 text-xs text-indigo-200/80">
                  Common upsells customers buy in this trade. Tap any to add it to your add-ons below.
                </p>
                <div className="flex flex-wrap gap-2">
                  {calculatorGuidance.addOnExamples.map((addOn) => {
                    const active = parseServiceList(form.addOnText).some(
                      (s) => s.toLowerCase() === addOn.toLowerCase()
                    );
                    return (
                      <button
                        key={addOn}
                        type="button"
                        onClick={() => toggleAddOn(addOn)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? 'border-indigo-300 bg-indigo-500/30 text-white'
                            : 'border-white/[0.14] bg-white/[0.02] text-zinc-300 hover:border-indigo-300/50 hover:bg-indigo-500/10'
                        }`}
                      >
                        {active ? '✓ ' : '+ '}
                        {addOn}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <textarea className={`${input} min-h-[72px] mb-2`} value={form.addOnText} onChange={(e) => set('addOnText', e.target.value)} placeholder={calculatorGuidance.addOnExamples.join(', ')} />
            <p className="mb-4 text-xs text-zinc-500">Tap a suggestion above or type your own, separated by commas.</p>

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

            {!isOrderBusiness && !isBookingBusiness && !isTicketBusiness && (
              <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.12] bg-white/[0.03] p-4">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent text-indigo-500"
                  checked={form.includeQuiz}
                  onChange={(e) => set('includeQuiz', e.target.checked)}
                />
                <span>
                  <span className="block text-sm font-medium text-zinc-100">
                    Include a short lead quiz on my homepage
                  </span>
                  <span className="mt-1 block text-xs text-zinc-500">
                    Optional. We&apos;ll add three trade-specific questions before the quote form so
                    visitors share what they need. Off by default — leave unchecked for a simpler site.
                  </span>
                </span>
              </label>
            )}
          </section>
          </div>

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

              {galleryCount > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                  {Array.from({ length: galleryCount }).map((_, i) => {
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
                        <div className="flex flex-col gap-3">
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
                            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-white/[0.16] bg-white/[0.02] px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-indigo-300/60 hover:bg-indigo-500/10"
                          >
                            Upload
                          </button>
                          <input
                            className={input}
                            type="url"
                            placeholder="Image URL"
                            value={entry.url}
                            disabled={!!entry.dataUrl}
                            onChange={(e) =>
                              setGalleryEntry(i, { url: e.target.value, dataUrl: '' })
                            }
                          />
                          {(entry.dataUrl || entry.url) && (
                            <div className="relative h-32 w-full">
                              <img
                                src={entry.dataUrl || entry.url}
                                alt={`Gallery ${i + 1}`}
                                className="h-full w-full rounded object-cover"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              ) : (
                <p className="rounded-md border border-white/[0.14] bg-white/[0.02] px-3 py-2 text-sm text-zinc-400">
                  No gallery images will be included.
                </p>
              )}

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
              <h2 className={sectionTitle}>Choose Your Pages</h2>
              <p className="mb-3 text-sm text-zinc-400">
                Pick the pages your site should include. AI-recommended offerings are optional and
                are added under Services — not as separate pages. Confirm when you&apos;re done;
                AI won&apos;t write copy until then.
              </p>
              <p className="mb-3 text-xs font-medium text-zinc-500">
                {form.pages.length} of {pageCap} pages selected
              </p>

              <div className="flex flex-wrap gap-2">
                {SITE_PAGE_OPTIONS.map((opt) => {
                  const selected = form.pages.includes(opt.slug);
                  const atCap = !selected && form.pages.length >= pageCap;
                  return (
                    <button
                      key={opt.slug}
                      type="button"
                      onClick={() => handleTogglePage(opt.slug)}
                      disabled={atCap}
                      title={opt.description}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        selected
                          ? 'border-indigo-400 bg-indigo-500/20 text-indigo-100'
                          : atCap
                            ? 'cursor-not-allowed border-white/10 text-zinc-600'
                            : 'border-white/15 text-zinc-300 hover:border-white/30 hover:text-white'
                      }`}
                    >
                      <span aria-hidden>{selected ? '✓' : '+'}</span>
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 rounded-lg border border-white/[0.1] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white">AI-Recommended Offerings</h3>
                    <p className="text-xs text-zinc-500">
                      Optional — add any you want under your Services page. Tailored to{' '}
                      {form.industry || 'your business'}.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleSuggestPages()}
                    disabled={suggestingPages}
                    className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-zinc-200 hover:border-white/30 hover:text-white disabled:opacity-60"
                  >
                    {suggestingPages ? (
                      <>
                        <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Suggesting…
                      </>
                    ) : (
                      <>
                        <span aria-hidden>✨</span>
                        {suggestedPages.length ? 'Refresh suggestions' : 'Suggest offerings'}
                      </>
                    )}
                  </button>
                </div>

                {addedAiServiceLabels.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1.5 text-xs font-medium text-zinc-500">Added under Services</p>
                    <div className="flex flex-wrap gap-2">
                      {addedAiServiceLabels.map((label) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => handleRemoveAiServiceOffering(label)}
                          title="Remove from Services"
                          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:border-emerald-300/60"
                        >
                          <span aria-hidden>✓</span>
                          {label}
                          <span aria-hidden className="text-emerald-300/80">×</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {suggestedPages.length > 0 ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {suggestedPages.map((s) => {
                      const alreadyAdded = addedAiServiceLabels.some(
                        (l) => l.toLowerCase() === s.label.trim().toLowerCase()
                      );
                      const servicesAtCap =
                        !form.pages.includes('services') && form.pages.length >= pageCap;
                      return (
                        <div
                          key={s.slug}
                          className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-zinc-100">{s.label}</p>
                            <p className="mt-0.5 text-xs text-zinc-500">{s.description}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddSuggestedPage(s)}
                            disabled={alreadyAdded || servicesAtCap}
                            className="shrink-0 rounded-md bg-white px-2.5 py-1.5 text-xs font-bold text-black hover:bg-slate-200 disabled:opacity-50"
                          >
                            {alreadyAdded ? 'Added' : 'Add'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  !suggestingPages && (
                    <p className="mt-3 text-xs text-zinc-600">
                      Click &quot;Suggest offerings&quot; for trade-specific ideas under Services.
                    </p>
                  )
                )}

                {form.pages.length >= pageCap && !form.pages.includes('services') && (
                  <p className="mt-3 text-xs text-amber-400/80">
                    You&apos;ve reached the {pageCap}-page limit. Remove a page (or select Services)
                    before adding AI offerings under Services.
                  </p>
                )}
              </div>

              {!pagesSelectionConfirmed && (
                <div className="mt-5 rounded-lg border border-indigo-400/30 bg-indigo-500/10 p-4">
                  <p className="text-sm text-indigo-100">
                    When you&apos;re finished choosing pages (AI offerings are optional), confirm below.
                    AI will only start writing page copy after you confirm.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleConfirmPagesSelection()}
                    disabled={form.pages.length === 0 || bulkGenerating}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-black hover:bg-slate-200 disabled:opacity-60 transition-colors"
                  >
                    Done selecting pages — write my copy
                  </button>
                </div>
              )}
            </section>

            {pagesSelectionConfirmed && (
            <section className={sectionClass}>
              <h2 className={sectionTitle}>
                Customize Page Content
              </h2>
              <p className="mb-4 text-sm text-zinc-400">
                Review and customize the sales copy for each of your selected pages. You can write your own or let the AI draft a bespoke version based on your intake information. Each page is limited to 1,200 words.
              </p>

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
                  const label = opt?.label || slug.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                  const desc = opt?.description || `Specific information regarding ${label.toLowerCase()}.`;
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
                      <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => setExpandedPage(isExpanded ? null : slug)}
                        className="flex flex-1 items-center justify-between px-4 py-3 text-left font-medium text-zinc-100 focus:outline-none"
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
                      <button
                        type="button"
                        onClick={() => {
                          handleRemovePage(slug);
                          if (isExpanded) setExpandedPage(null);
                        }}
                        aria-label={`Remove ${label} page`}
                        title="Remove this page"
                        className="px-3 py-3 text-zinc-500 hover:text-red-400 focus:outline-none"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                      </div>

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
            )}
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
              beforeAfterApplicable={initialBeforeAfterApplicable}
              onUpdate={(sel, site) => {
                setImageSelections(sel);
                if (site) setAiSiteConfig(site as Record<string, unknown>);
              }}
              formState={form}
              isActive={currentStepIndex === stepIdx.imageStudio}
            />
            </div>
          )}

          <div className="">
            {intakeTier === 'ai_premium' && canUseImageStudio && !premiumImagesReady && (
              <p className="text-sm text-amber-800 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 mb-4">
                Complete the AI image studio (hero + each service
                {beforeAfterRequired ? ' + before/after choice' : ''}) before submitting.
              </p>
            )}

            {error && (
              <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {isLastStep ? (
              <button
                type="button"
                disabled={submitting || (intakeTier === 'ai_premium' && !premiumImagesReady)}
                onClick={() => void handleReviewClick()}
                className="w-full rounded-xl bg-white px-5 py-3 font-bold text-black hover:bg-slate-200 disabled:opacity-50 sm:px-6"
              >
                {submitting ? 'Submitting…' : 'Submit →'}
              </button>
            ) : (
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

