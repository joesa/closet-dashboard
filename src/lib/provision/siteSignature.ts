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

const EYEBROWS = [
  'How we work',
  'On every job',
  'What clients notice',
  'In practice',
  'From the shop',
  'Locally',
  'Day to day',
  'Before we start',
  'After the call',
  'Out in the field',
  'What we stand for',
  'How we show up',
  'Real talk',
  'The short version',
  'Behind the work',
  'For homeowners',
  'For businesses nearby',
  'What matters here',
  'Our habit',
  'Proven nearby',
  'Straight answers',
  'Built around you',
  'Steady hands',
  'Clear next steps',
]

const METHOD_WORDS = ['Method', 'Process', 'Standard', 'Approach', 'System', 'Craft']

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
}): ProvisionSignature {
  const seed = (opts.seed || opts.businessName || 'site').trim()
  const brand = brandToken(opts.businessName || 'Studio')
  const method = METHOD_WORDS[hashSeed(`${seed}::method`) % METHOD_WORDS.length]
  return {
    processName: `The ${brand} ${method}`,
    motif: MOTIFS[hashSeed(`${seed}::motif`) % MOTIFS.length],
    eyebrow: EYEBROWS[hashSeed(`${seed}::eyebrow`) % EYEBROWS.length],
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
