/**
 * A per-business design direction that needs no model call.
 *
 * fallbackEnhancedBrief used to return the same five hexes for every business on
 * the platform, and a *description* where a font name belongs ("choose a real
 * Google Font"). Any run without a working enhancer — no API key, enhancer
 * timeout, malformed JSON — therefore produced a guaranteed collision and a
 * direction the site generator could not execute. This module replaces that
 * constant with a seeded pick that is stable per business and probes away from
 * directions already taken.
 *
 * The pools are curated, not generated: every ground, accent and type pairing
 * here is one the design system would accept, so no combination this module can
 * emit trips design_banned_font_family, design_dark_neon_skin or
 * design_cream_terracotta_skin. That property is asserted in the tests — the
 * fallback is structurally incapable of producing what the prompts ban.
 *
 * Pure. Same seeding approach as provision/resolveDesignSeed.ts, which probes
 * for an unused engine fingerprint the same way.
 */

import { hashSeed } from '@/lib/catalog/designFingerprint'

export type DirectionPaletteRole = { role: string; hex: string; use: string }

export type DeterministicDirection = {
  palette: DirectionPaletteRole[]
  typography: { display: string; body: string; why: string }
  signatureElement: string
  composition: string
  /** How many probes it took to miss the taken lists — 0 on a clean first pick. */
  seedIndex: number
}

export type DirectionSeedInput = {
  brandName: string
  city?: string
  region?: string
  services?: string[]
  themeHint?: string
  /** Palette keys already in use, from the avoid list. */
  takenPaletteKeys?: string[]
  /** `display+body` keys already in use, lowercased. */
  takenFontKeys?: string[]
}

type Ground = {
  id: string
  bg: string
  ink: string
  muted: string
  line: string
  note: string
}

/**
 * Grounds. Mid and light surfaces dominate because the design system says to
 * prefer them; the two dark grounds are low-chroma slates, never the near-black
 * that pairs with a neon accent to make the banned "auto shop AI" skin.
 */
export const GROUND_POOL: readonly Ground[] = [
  { id: 'shop-floor', bg: '#eef2f1', ink: '#1a1f1e', muted: '#5a6562', line: '#c5d0cc', note: 'cool shop-floor ground' },
  { id: 'mill-grey', bg: '#e9eaec', ink: '#191b1f', muted: '#5c6067', line: '#c6c9ce', note: 'mill grey, machined and neutral' },
  { id: 'chalk', bg: '#f2f1ed', ink: '#20211d', muted: '#61635c', line: '#d2d1c9', note: 'chalk board dust, warm neutral' },
  { id: 'drafting-blue', bg: '#e8edf2', ink: '#15202b', muted: '#556370', line: '#c2cdd8', note: 'drafting paper blue-grey' },
  { id: 'linen', bg: '#efece6', ink: '#22201c', muted: '#635f57', line: '#d4cfc4', note: 'unbleached linen' },
  { id: 'quarry', bg: '#e6e4e1', ink: '#1d1c1a', muted: '#5f5d59', line: '#cbc8c3', note: 'quarry stone, dry and matte' },
  { id: 'sea-glass', bg: '#e7efee', ink: '#16211f', muted: '#556361', line: '#c3d2d0', note: 'sea glass, cool and clean' },
  { id: 'kraft', bg: '#ece7de', ink: '#241f18', muted: '#655e52', line: '#d1c9ba', note: 'kraft board, workshop brown-grey' },
  { id: 'slate-dark', bg: '#232a2e', ink: '#eef1f2', muted: '#9aa5aa', line: '#39434a', note: 'wet slate, dark but not black' },
  { id: 'ink-dark', bg: '#252430', ink: '#eceaf2', muted: '#9d9aab', line: '#3b3a4a', note: 'printer ink, dark violet-grey' },
]

type Accent = { id: string; hex: string; note: string }

/**
 * Accents. No neon (nothing above ~0.7 saturation in the lime/cyan/acid-gold
 * bands) and no terracotta, which is half of the cream+clay habit skin.
 */
export const ACCENT_POOL: readonly Accent[] = [
  { id: 'enamel-green', hex: '#2f5d50', note: 'enamel green' },
  { id: 'workwear-denim', hex: '#35506b', note: 'workwear denim' },
  { id: 'oxblood', hex: '#6b2733', note: 'oxblood leather' },
  { id: 'pine', hex: '#2f4f43', note: 'deep pine' },
  { id: 'brass', hex: '#8a7256', note: 'aged brass' },
  { id: 'ochre', hex: '#8a6a1f', note: 'dark ochre' },
  { id: 'wine', hex: '#7d2f3a', note: 'wine red' },
  { id: 'harbour', hex: '#1f4e5f', note: 'harbour teal' },
  // Darker and less orange than a literal bronze: #7a4b23 lands at hue 28° with
  // saturation 0.55, which is terracotta by any measure and pairs with the
  // light grounds here to reproduce the cream+clay skin the design system bans.
  { id: 'bronze', hex: '#5f4326', note: 'dark bronze' },
  { id: 'ironstone', hex: '#4a4f57', note: 'ironstone grey' },
  { id: 'moss', hex: '#4a5d34', note: 'moss green' },
  { id: 'plum-ink', hex: '#4b3552', note: 'plum ink' },
  { id: 'signal-red', hex: '#9c3123', note: 'signal red' },
  { id: 'lake', hex: '#2b5f78', note: 'lake blue' },
  { id: 'olive-drab', hex: '#5b5b31', note: 'olive drab' },
  { id: 'copper-patina', hex: '#3f6f66', note: 'copper patina' },
]

type TypePair = { display: string; body: string; why: string }

/** Google Font pairings. None of these is on the banned-by-habit list. */
export const TYPE_PAIR_POOL: readonly TypePair[] = [
  { display: 'Fraunces', body: 'Karla', why: 'a worked serif over a plain grotesque — craft without preciousness' },
  { display: 'Bitter', body: 'Public Sans', why: 'slab headings with a civic-register body' },
  { display: 'Archivo', body: 'Lora', why: 'condensed signage over a readable serif' },
  { display: 'Newsreader', body: 'Work Sans', why: 'editorial serif, neutral body' },
  { display: 'Instrument Serif', body: 'Manrope', why: 'a high-contrast serif with a quiet companion' },
  { display: 'Sora', body: 'Source Serif 4', why: 'engineered sans over a warm serif' },
  { display: 'Libre Franklin', body: 'Spectral', why: 'a newspaper pairing, plain then literary' },
  { display: 'Zilla Slab', body: 'Cabin', why: 'slab with a practical humanist body' },
  { display: 'Playfair Display', body: 'Mulish', why: 'a formal display with an unfussy body' },
  { display: 'Oswald', body: 'Lato', why: 'depot signage over a neutral body' },
  { display: 'Domine', body: 'Assistant', why: 'sturdy serif headings, light body' },
  { display: 'Vollkorn', body: 'Jost', why: 'a bookish serif with a geometric companion' },
  { display: 'Chivo', body: 'Literata', why: 'grotesque headings over a reading serif' },
  { display: 'Rokkitt', body: 'Nunito Sans', why: 'a narrow slab over a rounded body' },
]

/** Distinct devices spanning spatial, photographic, typographic and tactile ideas. */
export const SIGNATURE_POOL: readonly string[] = [
  'A full-bleed documentary photograph interrupted by one oversized vertical wordmark',
  'A compact service index fixed to one edge while the story scrolls beside it',
  'A typographic poster system with huge plain-language headlines and almost no boxes',
  'An irregular image mosaic whose crop ratios follow the business work rather than a card grid',
  'A quiet single-column reading experience with one dramatic scale change per chapter',
  'A bold horizontal ribbon that carries services through the page as one continuous sequence',
  'A tactile material strip sampled from the trade and used only at major transitions',
  'An offset frame system where images deliberately break the text measure and page edge',
  'A compact utility composition with dense labels, direct actions and minimal decorative copy',
  'A cinematic sequence of edge-to-edge scenes with captions embedded in the image margins',
  'A split-screen composition with navigation and conversion fixed opposite a scrolling narrative',
  'A radial or clustered composition organized around the customer outcome rather than sections',
]

export const COMPOSITION_POOL: readonly string[] = [
  'immersive image-led sequence with edge-to-edge transitions and sparse text',
  'asymmetric editorial canvas with unequal columns and deliberate empty space',
  'dense catalog index with compact rows, filters-as-labels, and no card grid',
  'typographic poster with monumental headlines, short copy, and flat color fields',
  'restrained single-column narrative with strong chapter breaks and inline media',
  'modular utility layout with varied module spans and action-first hierarchy',
  'horizontal story rhythm using wide bands and side-scrolling visual cues without JavaScript',
  'split-screen shell with persistent conversion rail and independently paced content',
  'irregular photographic mosaic with text anchored to image geometry',
  'minimal gallery architecture where imagery controls scale, pacing, and navigation',
]

function norm(value: string | undefined): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function paletteKeyOf(ground: Ground, accent: Accent): string {
  return `${ground.id}+${accent.id}`
}

function fontKeyOf(pair: TypePair): string {
  return `${pair.display}+${pair.body}`.toLowerCase()
}

/** Probe ceiling — matches resolveDesignSeed's shape. */
const MAX_PROBES = 250

/**
 * Pick a direction from the seed, stepping past combinations already in use.
 *
 * Stepping the three pools by co-prime-ish offsets rather than re-hashing keeps
 * the walk deterministic and spreads it across the space instead of clustering
 * near the first pick.
 */
export function pickDeterministicDirection(
  input: DirectionSeedInput
): DeterministicDirection {
  const seedString = [
    norm(input.brandName),
    norm(input.city),
    norm(input.region),
    (input.services || []).map(norm).sort().join(','),
    norm(input.themeHint),
  ].join('|')
  const seed = hashSeed(seedString)

  const takenPalettes = new Set((input.takenPaletteKeys || []).map((k) => k.toLowerCase()))
  const takenFonts = new Set((input.takenFontKeys || []).map((k) => k.toLowerCase()))

  let ground = GROUND_POOL[seed % GROUND_POOL.length]
  let accent = ACCENT_POOL[(seed >>> 3) % ACCENT_POOL.length]
  let pair = TYPE_PAIR_POOL[(seed >>> 7) % TYPE_PAIR_POOL.length]
  let seedIndex = 0

  for (let probe = 0; probe < MAX_PROBES; probe += 1) {
    ground = GROUND_POOL[(seed + probe) % GROUND_POOL.length]
    accent = ACCENT_POOL[((seed >>> 3) + probe * 3) % ACCENT_POOL.length]
    pair = TYPE_PAIR_POOL[((seed >>> 7) + probe * 5) % TYPE_PAIR_POOL.length]
    seedIndex = probe
    if (
      !takenPalettes.has(paletteKeyOf(ground, accent)) &&
      !takenFonts.has(fontKeyOf(pair))
    ) {
      break
    }
  }

  return {
    palette: [
      { role: 'bg', hex: ground.bg, use: `${ground.note} — page surface` },
      { role: 'ink', hex: ground.ink, use: 'primary text' },
      { role: 'muted', hex: ground.muted, use: 'secondary text' },
      { role: 'line', hex: ground.line, use: 'rules and borders' },
      { role: 'acc', hex: accent.hex, use: `${accent.note} — primary CTA and accents` },
    ],
    typography: {
      display: pair.display,
      body: pair.body,
      why: pair.why,
    },
    signatureElement:
      SIGNATURE_POOL[((seed >>> 11) + seedIndex * 7) % SIGNATURE_POOL.length],
    composition:
      COMPOSITION_POOL[((seed >>> 15) + seedIndex * 3) % COMPOSITION_POOL.length],
    seedIndex,
  }
}

/** The keys this direction would occupy, for collision reporting. */
export function directionKeys(direction: DeterministicDirection): {
  paletteKey: string
  fontKey: string
} {
  const bg = direction.palette.find((p) => p.role === 'bg')?.hex ?? ''
  const acc = direction.palette.find((p) => p.role === 'acc')?.hex ?? ''
  const ground = GROUND_POOL.find((g) => g.bg === bg)
  const accent = ACCENT_POOL.find((a) => a.hex === acc)
  return {
    paletteKey: ground && accent ? paletteKeyOf(ground, accent) : `${bg}+${acc}`,
    fontKey: `${direction.typography.display}+${direction.typography.body}`.toLowerCase(),
  }
}
