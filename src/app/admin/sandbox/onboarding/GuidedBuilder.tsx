'use client';

import React, { useState } from 'react';

export type GuidedResult = {
  description: string;
  theme?: string;
  layoutStyle?: string;
  services?: string[];
  businessName?: string;
  heroHeadline?: string;
  aboutDescription?: string;
};

// Maps the human "vibe" answer to a concrete site theme slug.
const VIBE_TO_THEME: Record<string, string> = {
  'Luxury & minimal': 'luxury-minimal',
  'Bold & industrial': 'brutalist',
  'Warm & classic': 'classic-warm',
  'Modern & clean': 'modern-office',
  'Playful & friendly': 'playful-kids',
  'Rustic & natural': 'rustic-pantry',
  'Elegant & refined': 'elegant-dressing',
  'Sleek & high-tech': 'sleek-entertainment',
};

// Maps the business type to a clean noun phrase used in headlines / copy.
const TYPE_TO_NOUN: Record<string, string> = {
  'Custom closets': 'Custom Closets',
  'Garage storage systems': 'Garage Storage',
  'Whole-home organization': 'Whole-Home Organization',
  'Pantry & kitchen storage': 'Pantry & Kitchen Storage',
  'Multi-service (several of the above)': 'Custom Storage',
};

// Maps the #1 desired action to the structural layout that best serves it.
const CTA_TO_LAYOUT: Record<string, string> = {
  'Book a free consultation': 'conversion-focus',
  'Request a quote': 'conversion-focus',
  'Call now': 'minimalist-lead',
  'Browse the portfolio': 'portfolio-first',
};

type Step =
  | { id: string; type: 'single' | 'multi'; question: string; help?: string; options: string[]; optional?: boolean }
  | { id: string; type: 'text'; question: string; help?: string; placeholder?: string; optional?: boolean };

const STEPS: Step[] = [
  {
    id: 'businessName',
    type: 'text',
    question: 'What is the business name?',
    placeholder: 'e.g. Apex Garage Builds',
  },
  {
    id: 'businessType',
    type: 'single',
    question: 'What kind of business is this?',
    help: 'Pick the closest fit — it shapes the whole site.',
    options: ['Custom closets', 'Garage storage systems', 'Whole-home organization', 'Pantry & kitchen storage', 'Multi-service (several of the above)'],
  },
  {
    id: 'services',
    type: 'multi',
    question: 'Which services do you offer?',
    help: 'Select all that apply.',
    options: [
      'Walk-In Closets',
      'Reach-In Closets',
      'Kids & Youth Closets',
      'Dressing Rooms & Boutique Storage',
      'Garages & Garage Storage',
      'Garage Flooring & Slatwall Systems',
      'Pantries & Wine Storage',
      'Mudrooms & Entryway Lockers',
      'Home Offices & Built-In Desks',
      'Wall Beds & Murphy Beds',
      'Entertainment & Media Centers',
      'Laundry & Utility Rooms',
      'Craft, Hobby & Sewing Rooms',
      'Home Libraries & Built-In Storage',
      'Whole-Home Organization',
      'Commercial & Office Storage',
    ],
  },
  {
    id: 'location',
    type: 'text',
    question: 'Where are you based / what area do you serve?',
    placeholder: 'e.g. Nashville and Middle Tennessee',
  },
  {
    id: 'customers',
    type: 'single',
    question: 'Who are your ideal customers?',
    options: ['Luxury homeowners', 'Busy families', 'Budget-conscious homeowners', 'Builders & commercial clients', 'A mix of everyone'],
  },
  {
    id: 'vibe',
    type: 'single',
    question: 'What look and feel do you want?',
    help: 'This sets the visual theme.',
    options: Object.keys(VIBE_TO_THEME),
  },
  {
    id: 'experience',
    type: 'single',
    question: 'How established is the business?',
    options: ['Just getting started', '1–5 years', '5–15 years', '15+ years / well established'],
  },
  {
    id: 'differentiators',
    type: 'multi',
    question: 'What makes you stand out?',
    help: 'Select all that apply.',
    options: ['Lifetime warranty', 'Free in-home consultation', 'Made in USA', 'Family-owned', 'Award-winning', 'Eco-friendly materials', 'Fast turnaround', 'Financing available'],
  },
  {
    id: 'tone',
    type: 'single',
    question: 'What tone should the writing have?',
    options: ['Professional & trustworthy', 'Friendly & approachable', 'Bold & confident', 'Elegant & refined'],
  },
  {
    id: 'cta',
    type: 'single',
    question: 'What is the #1 action you want visitors to take?',
    options: ['Book a free consultation', 'Request a quote', 'Call now', 'Browse the portfolio'],
  },
  {
    id: 'notes',
    type: 'text',
    question: 'Anything else we should know?',
    placeholder: 'Optional — special offers, awards, story, etc.',
    optional: true,
  },
];

function buildDescription(answers: Record<string, string | string[]>): string {
  const get = (id: string) => answers[id];
  const arr = (id: string) => (Array.isArray(get(id)) ? (get(id) as string[]) : []);
  const str = (id: string) => (typeof get(id) === 'string' ? (get(id) as string) : '');

  const parts: string[] = [];
  if (str('businessName')) parts.push(`Business name: ${str('businessName')}.`);
  parts.push(`This is a ${str('businessType') || 'home storage & organization'} business.`);
  if (str('location')) parts.push(`It serves ${str('location')}.`);
  if (arr('services').length) parts.push(`Services offered: ${arr('services').join(', ')}.`);
  if (str('customers')) parts.push(`Ideal customers: ${str('customers')}.`);
  if (str('vibe')) parts.push(`Desired look and feel: ${str('vibe')}.`);
  if (str('experience')) parts.push(`Experience level: ${str('experience')}.`);
  if (arr('differentiators').length) parts.push(`Key selling points: ${arr('differentiators').join(', ')}.`);
  if (str('tone')) parts.push(`Preferred tone of voice: ${str('tone')}.`);
  if (str('cta')) parts.push(`Primary call to action: ${str('cta')}.`);
  if (str('notes')) parts.push(`Additional notes: ${str('notes')}.`);
  return parts.join(' ');
}

// Craft a punchy hero headline from the answers (operator can edit afterward).
function buildHeroHeadline(answers: Record<string, string | string[]>): string {
  const str = (id: string) => (typeof answers[id] === 'string' ? (answers[id] as string) : '');
  const noun = TYPE_TO_NOUN[str('businessType')] || 'Custom Storage';
  switch (str('tone')) {
    case 'Bold & confident':
      return `${noun} That Command Every Room`;
    case 'Elegant & refined':
      return `Bespoke ${noun} for the Discerning Home`;
    case 'Friendly & approachable':
      return `${noun} That Make Everyday Life Simpler`;
    default:
      return `Custom ${noun}, Crafted to Last`;
  }
}

// Auto-craft a 2-3 sentence About Us story from the answers (operator can edit).
function buildAboutDescription(answers: Record<string, string | string[]>): string {
  const str = (id: string) => (typeof answers[id] === 'string' ? (answers[id] as string) : '');
  const arr = (id: string) => (Array.isArray(answers[id]) ? (answers[id] as string[]) : []);

  const name = str('businessName') || 'Our team';
  const noun = (TYPE_TO_NOUN[str('businessType')] || 'custom storage').toLowerCase();
  const services = arr('services');
  const serviceText = services.length ? services.slice(0, 4).join(', ').toLowerCase() : noun;
  const loc = str('location');

  const expPhrase: Record<string, string> = {
    'Just getting started': 'is a fresh, customer-obsessed team',
    '1–5 years': 'has spent years perfecting its craft',
    '5–15 years': 'brings over a decade of craftsmanship',
    '15+ years / well established': 'has more than 15 years of trusted experience',
  };
  const phrase = expPhrase[str('experience')] || 'is dedicated to exceptional craftsmanship';

  const s1 = `${name} ${phrase}${loc ? ` serving ${loc}` : ''}, specializing in ${serviceText}.`;
  const s2 = str('customers') ? ` We design beautiful, functional spaces for ${str('customers').toLowerCase()}.` : '';
  const diffs = arr('differentiators');
  const s3 = diffs.length ? ` What sets us apart: ${diffs.slice(0, 3).join(', ').toLowerCase()}.` : '';
  return (s1 + s2 + s3).trim();
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

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const current = answers[step.id];

  const isAnswered =
    step.optional ||
    (step.type === 'multi' ? Array.isArray(current) && current.length > 0 : !!(typeof current === 'string' && current.trim()));

  const setSingle = (value: string) => setAnswers((a) => ({ ...a, [step.id]: value }));
  const toggleMulti = (value: string) =>
    setAnswers((a) => {
      const list = Array.isArray(a[step.id]) ? (a[step.id] as string[]) : [];
      return { ...a, [step.id]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] };
    });

  const finish = () => {
    onComplete({
      description: buildDescription(answers),
      theme: VIBE_TO_THEME[(answers['vibe'] as string) || ''],
      layoutStyle: CTA_TO_LAYOUT[(answers['cta'] as string) || ''],
      services: Array.isArray(answers['services']) ? (answers['services'] as string[]) : [],
      businessName: typeof answers['businessName'] === 'string' ? (answers['businessName'] as string) : undefined,
      heroHeadline: buildHeroHeadline(answers),
      aboutDescription: buildAboutDescription(answers),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg bg-neutral-800 border border-neutral-700 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-neutral-700">
          <div>
            <h2 className="text-lg font-bold text-white">Guided Site Builder</h2>
            <p className="text-xs text-neutral-400">Step {stepIndex + 1} of {STEPS.length}</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white text-xl leading-none" aria-label="Close">×</button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-neutral-700">
          <div className="h-full bg-indigo-500 transition-all" style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }} />
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

          {step.type === 'single' && (
            <div className="flex flex-col gap-2">
              {step.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setSingle(opt)}
                  className={`text-left px-4 py-2.5 rounded-md border transition-colors text-sm ${
                    current === opt ? 'border-indigo-500 bg-indigo-900/40 text-white' : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-500'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {step.type === 'multi' && (
            <div className="grid grid-cols-2 gap-2">
              {step.options.map((opt) => {
                const selected = Array.isArray(current) && current.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleMulti(opt)}
                    className={`text-left px-3 py-2 rounded-md border transition-colors text-sm ${
                      selected ? 'border-indigo-500 bg-indigo-900/40 text-white' : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-500'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
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
              Build my brief
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
