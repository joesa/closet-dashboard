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
  'Compassionate care',
  'Patient care',
  'In practice',
  'How we care',
  'For your family',
  'Our approach',
  'Clinical excellence',
  'Patient-first',
]

const EYEBROWS_WELLNESS = [
  'Serene care',
  'The experience',
  'In studio',
  'Holistic care',
  'Mind & Body',
  'Your wellbeing',
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

// Trade-specific terms used for process names — medical gets "Care Approach"
const METHOD_WORDS_TRADE = ['Method', 'Process', 'Standard', 'Approach', 'System', 'Craft']
const METHOD_WORDS_MEDICAL = ['Care Approach', 'Care Standard', 'Care Process']
const METHOD_WORDS_PROFESSIONAL = ['Practice', 'Approach', 'Standard', 'Method']
const METHOD_WORDS_WELLNESS = ['Experience', 'Approach', 'Method', 'Practice']

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

function getMethodWords(hint: VerticalHint): string[] {
  switch (hint) {
    case 'medical': return METHOD_WORDS_MEDICAL
    case 'wellness': return METHOD_WORDS_WELLNESS
    case 'professional': return METHOD_WORDS_PROFESSIONAL
    default: return METHOD_WORDS_TRADE
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

function brandToken(brandName: string): string {
  const cleaned = brandName
    .replace(/\b(llc|inc|co|company|the|and|&)\b/gi, ' ')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'Studio'
  return parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
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
  const brand = brandToken(opts.businessName || 'Studio')
  const hint = detectVerticalHint(opts.industry, opts.services)
  const methodWords = getMethodWords(hint)
  const eyebrowPool = getEyebrowPool(hint)
  const method = methodWords[hashSeed(`${seed}::method`) % methodWords.length]
  return {
    processName: `The ${brand} ${method}`,
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
