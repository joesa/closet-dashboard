/**
 * Design fingerprint — server-side mirror.
 *
 * MUST stay byte-for-byte compatible with the canonical implementation in
 * custom-closets-websites/src/lib/{designVariants,theme}.ts:
 *   - hashSeed()            -> FNV-1a, identical
 *   - structuralFingerprint -> same salts + axis lengths
 *   - designFingerprint     -> same voice/accent pool sizes per theme
 *
 * If you change the renderer's structural axes, THEME_VOICE, HEADING_VOICE /
 * BODY_VOICE pool sizes, or THEME_ACCENTS pool sizes, update the tables below.
 * This mirror only needs the *counts* (never the actual font/color values), so
 * the surface that can drift is intentionally tiny.
 *
 * Used by the provisioner to guarantee every new site gets a design that is not
 * an exact duplicate of one already in use (probed per-theme).
 */

/** Deterministic 32-bit FNV-1a hash — mirrors designVariants.ts hashSeed. */
export function hashSeed(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

// Fixed structural axis lengths (HERO/ALIGN/ABOUT/PORTFOLIO/TYPE).
const AXIS = { hero: 16, align: 2, about: 5, portfolio: 5, type: 4 } as const

// ─── Answer-optimized weighting (mirrors designVariants.ts) ──────────────────
type DesignArchetype = 'luxe' | 'editorial' | 'modern' | 'bold' | 'playful'

const THEME_ARCHETYPE: Record<string, DesignArchetype> = {
  'luxury-minimal': 'luxe',
  brutalist: 'bold',
  'classic-warm': 'editorial',
  'modern-office': 'modern',
  'playful-kids': 'playful',
  'rustic-pantry': 'editorial',
  'sleek-entertainment': 'modern',
  'elegant-dressing': 'luxe',
  'functional-utility': 'modern',
  'creative-craft': 'playful',
  'sophisticated-wine': 'luxe',
  'cozy-library': 'editorial',
  'minimalist-zen': 'modern',
  'garage-industrial': 'bold',
  'pantry-fresh': 'editorial',
  'laundry-clean': 'modern',
  'mudroom-family': 'editorial',
  'commercial-pro': 'modern',
  'coastal-climate': 'luxe',
  'historic-classic': 'editorial',
  'luxury-gallery': 'luxe',
  'kids-playful': 'playful',
  'media-theater': 'modern',
  'office-executive': 'modern',
  'wine-cellar': 'luxe',

  // New trade-vertical themes
  'fresh-clean': 'modern',
  'warm-handyman': 'editorial',
  'rich-flooring': 'editorial',
  'artisan-wood': 'editorial',
  'swift-mobile': 'modern',
  'clean-move': 'modern',
  'urban-reclaim': 'bold',
  'stone-masonry': 'bold',
  'appliance-pro': 'modern',
  'care-comfort': 'playful',

  // Second wave
  'pool-resort': 'luxe',
  'home-guardian': 'modern',
  'eco-solar': 'modern',
  'pastoral-pet': 'playful',
  'hearth-warm': 'editorial',
  'seasonal-outdoor': 'modern',
  'garage-smart': 'modern',
  'window-light': 'luxe',

  // Third wave
  'bold-remodel': 'bold',
  'winter-ready': 'modern',
  'event-festive': 'playful',
  'wellness-calm': 'modern',
  'fleet-logistics': 'modern',
  'media-creative': 'modern',
  'gourmet-warm': 'editorial',
}

function weightVector(len: number, boosts: Record<number, number>): number[] {
  return Array.from({ length: len }, (_, i) => 1 + (boosts[i] ?? 0))
}

const HERO_WEIGHTS: Record<DesignArchetype, number[]> = {
  luxe: weightVector(16, { 2: 4, 5: 4, 13: 3, 3: 2, 4: 2, 6: 2, 0: 1 }),
  editorial: weightVector(16, { 2: 3, 14: 3, 6: 2, 7: 2, 8: 2, 3: 1 }),
  modern: weightVector(16, { 1: 3, 7: 3, 9: 2, 10: 2, 4: 2, 15: 1 }),
  bold: weightVector(16, { 0: 4, 12: 3, 14: 3, 10: 2, 15: 2 }),
  playful: weightVector(16, { 15: 4, 11: 3, 3: 3, 4: 2, 13: 2, 12: 1 }),
}

const TYPE_WEIGHTS: Record<DesignArchetype, number[]> = {
  luxe: weightVector(4, { 2: 3, 3: 3, 1: 1 }),
  editorial: weightVector(4, { 1: 3, 2: 2 }),
  modern: weightVector(4, { 0: 3, 1: 3 }),
  bold: weightVector(4, { 3: 4, 2: 2 }),
  playful: weightVector(4, { 2: 3, 1: 2 }),
}

function weightedIndex(seed: string, salt: string, weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0)
  let r = hashSeed(`${seed}::${salt}`) % total
  for (let i = 0; i < weights.length; i++) {
    if (r < weights[i]) return i
    r -= weights[i]
  }
  return weights.length - 1
}

function heroIndex(seed: string, theme?: string | null): number {
  const arch = theme ? THEME_ARCHETYPE[theme] : undefined
  if (!arch) return hashSeed(`${seed}::hero`) % AXIS.hero
  return weightedIndex(seed, 'hero', HERO_WEIGHTS[arch])
}

function typeIndex(seed: string, theme?: string | null): number {
  const arch = theme ? THEME_ARCHETYPE[theme] : undefined
  if (!arch) return hashSeed(`${seed}::type`) % AXIS.type
  return weightedIndex(seed, 'type', TYPE_WEIGHTS[arch])
}

function structuralFingerprint(seed: string, theme?: string | null): string {
  return [
    heroIndex(seed, theme),
    hashSeed(`${seed}::align`) % AXIS.align,
    hashSeed(`${seed}::about`) % AXIS.about,
    hashSeed(`${seed}::portfolio`) % AXIS.portfolio,
    typeIndex(seed, theme),
  ].join('.')
}

type VoiceFamily = 'luxe' | 'editorial' | 'modernSans' | 'boldDisplay' | 'playful'

// Heading/body typeface pool SIZES per voice family (values mirror theme.ts).
const FAMILY_POOL: Record<VoiceFamily, { head: number; body: number }> = {
  luxe: { head: 4, body: 3 },
  editorial: { head: 5, body: 2 },
  modernSans: { head: 4, body: 2 },
  boldDisplay: { head: 3, body: 3 },
  playful: { head: 4, body: 2 },
}

const THEME_VOICE: Record<string, VoiceFamily> = {
  'luxury-minimal': 'luxe',
  brutalist: 'boldDisplay',
  'classic-warm': 'editorial',
  'modern-office': 'modernSans',
  'playful-kids': 'playful',
  'rustic-pantry': 'editorial',
  'sleek-entertainment': 'modernSans',
  'elegant-dressing': 'luxe',
  'functional-utility': 'modernSans',
  'creative-craft': 'playful',
  'sophisticated-wine': 'luxe',
  'cozy-library': 'editorial',
  'minimalist-zen': 'modernSans',
  'garage-industrial': 'boldDisplay',
  'pantry-fresh': 'editorial',
  'laundry-clean': 'modernSans',
  'mudroom-family': 'editorial',
  'commercial-pro': 'modernSans',
  'coastal-climate': 'luxe',
  'historic-classic': 'editorial',
  'luxury-gallery': 'luxe',
  'kids-playful': 'playful',
  'media-theater': 'modernSans',
  'office-executive': 'modernSans',
  'wine-cellar': 'luxe',

  // New trade-vertical themes
  'fresh-clean': 'modernSans',
  'warm-handyman': 'editorial',
  'rich-flooring': 'editorial',
  'artisan-wood': 'editorial',
  'swift-mobile': 'modernSans',
  'clean-move': 'modernSans',
  'urban-reclaim': 'boldDisplay',
  'stone-masonry': 'boldDisplay',
  'appliance-pro': 'modernSans',
  'care-comfort': 'playful',

  // Second wave
  'pool-resort': 'luxe',
  'home-guardian': 'modernSans',
  'eco-solar': 'modernSans',
  'pastoral-pet': 'playful',
  'hearth-warm': 'editorial',
  'seasonal-outdoor': 'modernSans',
  'garage-smart': 'modernSans',
  'window-light': 'luxe',

  // Third wave
  'bold-remodel': 'boldDisplay',
  'winter-ready': 'modernSans',
  'event-festive': 'playful',
  'wellness-calm': 'modernSans',
  'fleet-logistics': 'modernSans',
  'media-creative': 'modernSans',
  'gourmet-warm': 'editorial',
}

// Accent swatch pool SIZE per theme (lengths of THEME_ACCENTS in theme.ts).
const ACCENT_POOL_SIZE: Record<string, number> = {
  'luxury-minimal': 4,
  brutalist: 3,
  'classic-warm': 4,
  'modern-office': 4,
  'playful-kids': 4,
  'rustic-pantry': 3,
  'sleek-entertainment': 3,
  'elegant-dressing': 4,
  'functional-utility': 3,
  'creative-craft': 4,
  'sophisticated-wine': 3,
  'cozy-library': 3,
  'minimalist-zen': 3,
  'garage-industrial': 3,
  'pantry-fresh': 3,
  'laundry-clean': 3,
  'mudroom-family': 3,
  'commercial-pro': 3,
  'coastal-climate': 3,
  'historic-classic': 3,
  'luxury-gallery': 3,
  'kids-playful': 3,
  'media-theater': 3,
  'office-executive': 3,
  'wine-cellar': 3,

  // New trade-vertical themes (each aliases an existing accent pool size)
  'fresh-clean': 3,
  'warm-handyman': 4,
  'rich-flooring': 3,
  'artisan-wood': 3,
  'swift-mobile': 3,
  'clean-move': 3,
  'urban-reclaim': 3,
  'stone-masonry': 3,
  'appliance-pro': 3,
  'care-comfort': 3,

  // Second wave
  'pool-resort': 3,
  'home-guardian': 3,
  'eco-solar': 3,
  'pastoral-pet': 3,
  'hearth-warm': 3,
  'seasonal-outdoor': 3,
  'garage-smart': 3,
  'window-light': 3,

  // Third wave
  'bold-remodel': 3,
  'winter-ready': 3,
  'event-festive': 3,
  'wellness-calm': 3,
  'fleet-logistics': 3,
  'media-creative': 3,
  'gourmet-warm': 4,
}

/**
 * Full design fingerprint within a theme: structure + typography + accent.
 * Two sites with the same theme and fingerprint render identically. Theme is
 * excluded from the string because uniqueness is enforced per-theme.
 */
export function designFingerprint(theme: string, seed: string): string {
  const struct = structuralFingerprint(seed, theme)
  const family = THEME_VOICE[theme] ?? 'luxe'
  const pool = FAMILY_POOL[family]
  const head = hashSeed(`${seed}:voice-head`) % pool.head
  const body = hashSeed(`${seed}:voice-body`) % pool.body
  const accentSize = ACCENT_POOL_SIZE[theme] ?? 3
  const accent = hashSeed(`${seed}:accent`) % accentSize
  return `${struct}.h${head}.b${body}.a${accent}`
}

/** The single canonical site seed — mirrors designVariants.ts siteSeed(). */
export function siteSeed(c: {
  designVariant?: string | null
  widgetId?: string | null
  brandName?: string | null
}): string {
  return (c.designVariant || c.widgetId || c.brandName || '').trim()
}
