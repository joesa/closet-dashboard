'use client';

import React, { useMemo, useState } from 'react';
import { listIndustries, resolveIndustrySlug, servicesForIndustry } from '@/lib/catalog/serviceCatalog';
import { resolveSitePresentationRules } from '@/lib/ai/resolveSitePresentation';
import { CTA_TO_LAYOUT, VIBE_TO_THEME } from '@/lib/catalog/sitePresentationCatalog';

export type GuidedResult = {
  description: string;
  industryLabel: string;
  theme: string;
  layoutStyle: string;
  services: string[];
  otherServices?: string;
  businessName?: string;
  serviceArea?: string;
  heroHeadline?: string;
  aboutDescription?: string;
  suggestedPageCount: number;
};

const INDUSTRY_OPTIONS = listIndustries()
  .map((i) => i.label)
  .sort((a, b) => a.localeCompare(b));

const VIBE_OPTIONS = Object.keys(VIBE_TO_THEME);
const TONE_OPTIONS = [
  'Professional & trustworthy',
  'Friendly & approachable',
  'Bold & confident',
  'Elegant & refined',
];
const CUSTOMER_OPTIONS = [
  'Luxury homeowners',
  'Busy families',
  'Budget-conscious homeowners',
  'Builders & commercial clients',
  'A mix of everyone',
];
const EXPERIENCE_OPTIONS = [
  'Just getting started',
  '1–5 years',
  '5–15 years',
  '15+ years / well established',
];
const DIFFERENTIATOR_OPTIONS = [
  'Lifetime warranty',
  'Free in-home consultation',
  'Made in USA',
  'Family-owned',
  'Award-winning',
  'Eco-friendly materials',
  'Fast turnaround',
  'Financing available',
  'Licensed & insured',
  '24/7 emergency service',
];
const CTA_OPTIONS = Object.keys(CTA_TO_LAYOUT);
const SITE_SIZE_OPTIONS = [
  { label: 'Single landing page', pages: 1 },
  { label: 'Focused 3-page site', pages: 3 },
  { label: 'Full multi-page site (5–6 pages)', pages: 5 },
];

type Step =
  | { id: string; type: 'text'; question: string; help?: string; placeholder?: string; optional?: boolean }
  | { id: string; type: 'single'; question: string; help?: string; options: string[]; optional?: boolean }
  | { id: string; type: 'multi'; question: string; help?: string; options: string[]; optional?: boolean }
  | { id: string; type: 'industry'; question: string; help?: string };

function str(answers: Record<string, string | string[]>, id: string): string {
  const v = answers[id];
  return typeof v === 'string' ? v.trim() : '';
}

function arr(answers: Record<string, string | string[]>, id: string): string[] {
  const v = answers[id];
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : [];
}

function buildDescription(answers: Record<string, string | string[]>): string {
  const lines: string[] = [];
  const add = (label: string, value: string) => {
    if (value) lines.push(`${label}: ${value}`);
  };

  add('Business name', str(answers, 'businessName'));
  add('Industry / trade', str(answers, 'industry'));
  add('Service area', str(answers, 'serviceArea'));

  const services = arr(answers, 'services');
  if (services.length) lines.push(`Services offered: ${services.join(', ')}`);
  add('Other / custom services', str(answers, 'otherServices'));

  add('Ideal customers', str(answers, 'customers'));
  add('Desired look and feel', str(answers, 'vibe'));
  add('Experience level', str(answers, 'experience'));
  add('Writing tone', str(answers, 'tone'));
  add('Primary call to action', str(answers, 'primaryCta'));

  const diffs = arr(answers, 'differentiators');
  if (diffs.length) lines.push(`Key differentiators: ${diffs.join(', ')}`);

  const siteSize = str(answers, 'siteSize');
  if (siteSize) lines.push(`Site scope: ${siteSize}.`);

  add('Additional notes', str(answers, 'notes'));

  return lines.join('\n');
}

function buildHeroHeadline(answers: Record<string, string | string[]>, industryLabel: string): string {
  const name = str(answers, 'businessName');
  const trade = industryLabel || 'local services';
  switch (str(answers, 'tone')) {
    case 'Bold & confident':
      return name ? `${name} — ${trade} Done Right` : `${trade} Built to Last`;
    case 'Elegant & refined':
      return name ? `Refined ${trade} by ${name}` : `Premium ${trade}`;
    case 'Friendly & approachable':
      return name ? `${name} — Your Trusted ${trade} Team` : `Trusted ${trade} Professionals`;
    default:
      return name ? `Welcome to ${name}` : `Professional ${trade}`;
  }
}

function buildAboutDescription(
  answers: Record<string, string | string[]>,
  industryLabel: string
): string {
  const name = str(answers, 'businessName') || 'Our team';
  const services = arr(answers, 'services');
  const serviceText = services.length
    ? services.slice(0, 4).join(', ').toLowerCase()
    : industryLabel.toLowerCase();
  const loc = str(answers, 'serviceArea');

  const expPhrase: Record<string, string> = {
    'Just getting started': 'is a dedicated, customer-focused team',
    '1–5 years': 'has spent years honing its craft',
    '5–15 years': 'brings over a decade of professional experience',
    '15+ years / well established': 'has more than 15 years of trusted expertise',
  };
  const phrase = expPhrase[str(answers, 'experience')] || 'is committed to exceptional work';

  const s1 = `${name} ${phrase}${loc ? ` serving ${loc}` : ''}, specializing in ${serviceText}.`;
  const s2 = str(answers, 'customers')
    ? ` We proudly serve ${str(answers, 'customers').toLowerCase()}.`
    : '';
  const diffs = arr(answers, 'differentiators');
  const s3 = diffs.length
    ? ` What sets us apart: ${diffs.slice(0, 3).join(', ').toLowerCase()}.`
    : '';
  return (s1 + s2 + s3).trim();
}

function suggestedPageCount(answers: Record<string, string | string[]>): number {
  const label = str(answers, 'siteSize');
  const match = SITE_SIZE_OPTIONS.find((o) => o.label === label);
  return match?.pages ?? 3;
}

function buildSteps(answers: Record<string, string | string[]>): Step[] {
  const industryLabel = str(answers, 'industry');
  const industrySlug = resolveIndustrySlug({ industry: industryLabel || undefined });
  const serviceOptions = servicesForIndustry(industrySlug).map((s) => s.label);

  return [
    {
      id: 'businessName',
      type: 'text',
      question: 'What is the business name?',
      placeholder: 'e.g. Summit Stone & Concrete',
    },
    {
      id: 'industry',
      type: 'industry',
      question: 'What industry or trade is this?',
      help: 'Pick the closest catalog match — it drives services, theme, and the quote calculator.',
    },
    {
      id: 'services',
      type: 'multi',
      question: 'Which services does this business offer?',
      help: industryLabel
        ? `Select all that apply for ${industryLabel}.`
        : 'Pick an industry first.',
      options: serviceOptions,
    },
    {
      id: 'otherServices',
      type: 'text',
      question: 'Any other services not listed above?',
      placeholder: 'Optional — comma-separated custom services',
      optional: true,
    },
    {
      id: 'serviceArea',
      type: 'text',
      question: 'Where are they based / what area do they serve?',
      placeholder: 'e.g. Denver metro and Front Range',
    },
    {
      id: 'customers',
      type: 'single',
      question: 'Who are their ideal customers?',
      options: CUSTOMER_OPTIONS,
    },
    {
      id: 'vibe',
      type: 'single',
      question: 'What look and feel should the site have?',
      help: 'Sets the visual theme.',
      options: VIBE_OPTIONS,
    },
    {
      id: 'experience',
      type: 'single',
      question: 'How established is the business?',
      options: EXPERIENCE_OPTIONS,
    },
    {
      id: 'differentiators',
      type: 'multi',
      question: 'What makes them stand out?',
      help: 'Select all that apply.',
      options: DIFFERENTIATOR_OPTIONS,
    },
    {
      id: 'tone',
      type: 'single',
      question: 'What tone should the writing have?',
      options: TONE_OPTIONS,
    },
    {
      id: 'primaryCta',
      type: 'single',
      question: 'What is the #1 action visitors should take?',
      options: CTA_OPTIONS,
    },
    {
      id: 'siteSize',
      type: 'single',
      question: 'How large should the website be?',
      help: 'Shapes the sitemap and page count.',
      options: SITE_SIZE_OPTIONS.map((o) => o.label),
    },
    {
      id: 'notes',
      type: 'text',
      question: 'Anything else we should know?',
      placeholder: 'Optional — awards, guarantees, specialties, pricing notes…',
      optional: true,
    },
  ];
}

export default function GuidedBuilder({
  onComplete,
  onClose,
}: {
  onComplete: (result: GuidedResult) => void;
  onClose: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [industryQuery, setIndustryQuery] = useState('');

  const steps = useMemo(() => buildSteps(answers), [answers]);
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const current = answers[step.id];

  const filteredIndustries = useMemo(() => {
    const q = industryQuery.trim().toLowerCase();
    if (!q) return INDUSTRY_OPTIONS;
    return INDUSTRY_OPTIONS.filter((label) => label.toLowerCase().includes(q));
  }, [industryQuery]);

  const isAnswered =
    step.type === 'industry'
      ? !!str(answers, 'industry')
      : 'optional' in step && step.optional
        ? true
        : step.type === 'multi'
          ? Array.isArray(current) && current.length > 0
          : !!(typeof current === 'string' && current.trim());

  const setSingle = (value: string) => {
    setAnswers((a) => {
      const next = { ...a, [step.id]: value };
      if (step.id === 'industry') {
        delete next.services;
        setIndustryQuery('');
      }
      return next;
    });
  };

  const toggleMulti = (value: string) =>
    setAnswers((a) => {
      const list = Array.isArray(a[step.id]) ? (a[step.id] as string[]) : [];
      return {
        ...a,
        [step.id]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
      };
    });

  const finish = () => {
    const industryLabel = str(answers, 'industry');
    const services = arr(answers, 'services');
    const otherServices = str(answers, 'otherServices');
    const presentation = resolveSitePresentationRules({
      industry: industryLabel,
      business_name: str(answers, 'businessName'),
      services,
      other_services: otherServices || undefined,
      service_area: str(answers, 'serviceArea') || undefined,
      vibe: str(answers, 'vibe') || undefined,
      tone: str(answers, 'tone') || undefined,
      customers: str(answers, 'customers') || undefined,
      experience: str(answers, 'experience') || undefined,
      differentiators: arr(answers, 'differentiators'),
      primary_cta: str(answers, 'primaryCta') || undefined,
      notes: str(answers, 'notes') || undefined,
    });

    onComplete({
      description: buildDescription(answers),
      industryLabel,
      theme: presentation.theme,
      layoutStyle: presentation.layoutStyle,
      services,
      otherServices: otherServices || undefined,
      businessName: str(answers, 'businessName') || undefined,
      serviceArea: str(answers, 'serviceArea') || undefined,
      heroHeadline: buildHeroHeadline(answers, industryLabel),
      aboutDescription: buildAboutDescription(answers, industryLabel),
      suggestedPageCount: suggestedPageCount(answers),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl bg-neutral-800 border border-neutral-700 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-neutral-700">
          <div>
            <h2 className="text-lg font-bold text-white">Guided Site Configuration</h2>
            <p className="text-xs text-neutral-400">
              Step {stepIndex + 1} of {steps.length} — builds a structured brief for AI
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="h-1 bg-neutral-700">
          <div
            className="h-full bg-indigo-500 transition-all"
            style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="p-6 overflow-y-auto">
          <h3 className="text-base font-semibold text-white mb-1">{step.question}</h3>
          {step.help && <p className="text-xs text-neutral-400 mb-4">{step.help}</p>}

          {step.type === 'text' && (
            <textarea
              value={(current as string) || ''}
              onChange={(e) => setSingle(e.target.value)}
              placeholder={step.placeholder}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-md p-3 text-white min-h-[90px]"
              autoFocus
            />
          )}

          {step.type === 'industry' && (
            <div className="space-y-3">
              <input
                type="search"
                value={industryQuery}
                onChange={(e) => setIndustryQuery(e.target.value)}
                placeholder="Search industries… e.g. concrete, plumbing, medical"
                className="w-full bg-neutral-900 border border-neutral-700 rounded-md p-3 text-white text-sm"
                autoFocus
              />
              <div className="max-h-64 overflow-y-auto flex flex-col gap-1.5 pr-1">
                {filteredIndustries.length === 0 ? (
                  <p className="text-xs text-neutral-500 px-2">No industries match that search.</p>
                ) : (
                  filteredIndustries.map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setSingle(label)}
                      className={`text-left px-4 py-2.5 rounded-md border transition-colors text-sm ${
                        current === label
                          ? 'border-indigo-500 bg-indigo-900/40 text-white'
                          : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-500'
                      }`}
                    >
                      {label}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {step.type === 'single' && (
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
              {step.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setSingle(opt)}
                  className={`text-left px-4 py-2.5 rounded-md border transition-colors text-sm ${
                    current === opt
                      ? 'border-indigo-500 bg-indigo-900/40 text-white'
                      : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-500'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {step.type === 'multi' && (
            <>
              {step.options.length === 0 ? (
                <p className="text-sm text-neutral-400">Select an industry on the previous step first.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto">
                  {step.options.map((opt) => {
                    const selected = Array.isArray(current) && current.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggleMulti(opt)}
                        className={`text-left px-3 py-2 rounded-md border transition-colors text-sm ${
                          selected
                            ? 'border-indigo-500 bg-indigo-900/40 text-white'
                            : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-500'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 p-5 border-t border-neutral-700">
          <button
            type="button"
            onClick={() => (stepIndex === 0 ? onClose() : setStepIndex((i) => i - 1))}
            className="px-4 py-2 rounded-md border border-neutral-600 hover:border-neutral-500 text-white text-sm font-bold transition-colors"
          >
            {stepIndex === 0 ? 'Cancel' : 'Back'}
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={finish}
              disabled={!isAnswered}
              className="px-6 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-colors disabled:opacity-50"
            >
              Build configuration brief
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStepIndex((i) => i + 1)}
              disabled={!isAnswered}
              className="px-6 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-colors disabled:opacity-50"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
