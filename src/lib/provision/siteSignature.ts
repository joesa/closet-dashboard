/**
 * Deterministic per-site designer signature for provisioned site_configs.
 * Mirrored client-side in custom-closets-websites/src/lib/siteSignature.ts
 * when this payload is absent (legacy rows).
 */

const MOTIFS = [
  'line',
  'dot',
  'bar',
  'double',
  'corner-brackets',
  'rule-stack',
  'seal',
  'ribbon',
] as const

// ── Vertical-specific eyebrow pools ─────────────────────────────────────────
// Medical / healthcare clinics must NEVER receive trade contractor eyebrows
// like "From the shop" or "Out in the field". Each pool is curated for its
// vertical's tone.

const EYEBROWS_MEDICAL = [
  'Patient care',
  'In practice',
  'How we care',
  'For your family',
  'Our approach',
  'Clinical care',
  'Patient-first',
  'At the clinic',
]

const EYEBROWS_WELLNESS = [
  'Serene care',
  'The experience',
  'In studio',
  'Mind & Body',
  'Your wellbeing',
  'Between visits',
]

const EYEBROWS_PROFESSIONAL = [
  'Our practice',
  'Client commitment',
  'In practice',
  'Strategic guidance',
  'With precision',
  'Clear counsel',
]

const EYEBROWS_TRADE = [
  'How we work',
  'On every job',
  'What clients notice',
  'In practice',
  'Day to day',
  'What we stand for',
  'How we show up',
  'Clear next steps',
  'Built around you',
  'Master craftsmanship',
  'Proven nearby',
  'Straight answers',
  'Steady hands',
  'What matters here',
  'For businesses nearby',
]

// Process-section titles. Deliberately NOT the "The {Brand} Method" formula —
// that fill-in-the-blank title is a recognisable generator signature (see
// findFormulaicTitles in humanCopyVoice.ts), so none of these may match it.
const PROCESS_TITLES_TRADE = [
  'How we run a job',
  'From first call to final walkthrough',
  'What happens after you book',
  'How the work gets done',
  'Start to finish',
  'How a project moves',
  'The order we work in',
  'What to expect on site',
]
const PROCESS_TITLES_MEDICAL = [
  'What a visit looks like',
  'From booking to follow-up',
  'How appointments work',
  'Your first visit, step by step',
  'What to expect at your visit',
  'How care moves forward',
]
const PROCESS_TITLES_PROFESSIONAL = [
  'How an engagement works',
  'From consultation to resolution',
  'What working together looks like',
  'How we take on new work',
  'From first meeting to final filing',
  'What happens after you reach out',
]
const PROCESS_TITLES_WELLNESS = [
  'What to expect',
  'From booking to your first session',
  'How sessions work',
  'Your first visit, start to finish',
  'How we set up your routine',
  'What a session looks like',
]

type VerticalHint = 'medical' | 'wellness' | 'professional' | 'trade'

/**
 * Lightweight regex classification of industry/services text into a vertical
 * hint for eyebrow and method-word selection. Mirrors detectVertical() logic
 * in suggestCraftAnswers.ts but simplified for copy selection only.
 */
function detectVerticalHint(industry?: string | null, services?: string[] | null): VerticalHint {
  const text = `${industry || ''} ${(services || []).join(' ')}`.toLowerCase()
  if (/med|clinic|pediatr|doctor|health|urgent care|hospital|dental|dentist|physician|therapy|therapist|optom|eye care|dermatol|chiro|podiatr|vet\b|veterin|psych|counsel|rehab|nursing|senior care|assisted living|foster care|daycare/i.test(text)) {
    return 'medical'
  }
  if (/salon|spa|barber|hair|beauty|esthetic|skincare|fitness|gym|yoga|pilates|massage|wellness|lash|nail|tanning/i.test(text)) {
    return 'wellness'
  }
  if (/legal|law|attorney|lawyer|account|cpa|tax|financial|real estate|insurance|consulting|architect|notary/i.test(text)) {
    return 'professional'
  }
  return 'trade'
}

function getEyebrowPool(hint: VerticalHint): string[] {
  switch (hint) {
    case 'medical': return EYEBROWS_MEDICAL
    case 'wellness': return EYEBROWS_WELLNESS
    case 'professional': return EYEBROWS_PROFESSIONAL
    default: return EYEBROWS_TRADE
  }
}

function getProcessTitlePool(hint: VerticalHint): string[] {
  switch (hint) {
    case 'medical': return PROCESS_TITLES_MEDICAL
    case 'wellness': return PROCESS_TITLES_WELLNESS
    case 'professional': return PROCESS_TITLES_PROFESSIONAL
    default: return PROCESS_TITLES_TRADE
  }
}

function hashSeed(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export type ProvisionSignature = {
  processName: string
  motif: (typeof MOTIFS)[number]
  eyebrow: string
}

export function buildProvisionSignature(opts: {
  businessName: string
  seed?: string | null
  industry?: string | null
  services?: string[] | null
}): ProvisionSignature {
  const seed = (opts.seed || opts.businessName || 'site').trim()
  const hint = detectVerticalHint(opts.industry, opts.services)
  const titlePool = getProcessTitlePool(hint)
  const eyebrowPool = getEyebrowPool(hint)
  return {
    processName: titlePool[hashSeed(`${seed}::method`) % titlePool.length],
    motif: MOTIFS[hashSeed(`${seed}::motif`) % MOTIFS.length],
    eyebrow: eyebrowPool[hashSeed(`${seed}::eyebrow`) % eyebrowPool.length],
  }
}

/** Prefer engagement-appropriate layout when the resolved one is a poor fit. */
export function biasLayoutForEngagement(
  layoutStyle: string,
  engagementModel: string
): string {
  const eng = (engagementModel || 'quote').toLowerCase()
  if (eng === 'order') {
    if (layoutStyle === 'before-after' || layoutStyle === 'process-steps') {
      return 'gallery-showcase'
    }
  }
  if (eng === 'booking') {
    if (layoutStyle === 'before-after' || layoutStyle === 'gallery-showcase') {
      return 'process-steps'
    }
  }
  if (eng === 'ticket') {
    if (layoutStyle === 'before-after' || layoutStyle === 'process-steps') {
      return 'event-booking'
    }
  }
  return layoutStyle
}
