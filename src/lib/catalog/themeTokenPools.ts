/**
 * Mirrors the curated "synthesized theme" token pools defined in
 * custom-closets-websites/src/lib/theme.ts (SURFACE_POOL / SHAPE_POOL /
 * SWATCH / voice families). This file only lists the legal IDs + short
 * descriptions (used to prompt Gemini) — the actual literal Tailwind classes
 * live solely in the renderer, since Tailwind's scanner requires literal
 * class strings physically present in that app's source.
 *
 * KEEP IN SYNC with custom-closets-websites/src/lib/theme.ts's
 * SURFACE_POOL / SHAPE_POOL / SWATCH / HEADING_VOICE+BODY_VOICE keys.
 */

export type ThemeTokenSelection = {
  surface: string
  shape: string
  voice: string
  swatch: string
}

export const SURFACE_TOKENS = [
  { id: 'warm-light', description: 'Bright white/stone background, warm neutral text — versatile default' },
  { id: 'cool-light', description: 'Cool slate/blue-grey light background — corporate, clean' },
  { id: 'soft-cream', description: 'Warm cream background, deep amber text — classic, inviting' },
  { id: 'fresh-sky', description: 'Pale sky-blue background — light, airy, approachable' },
  { id: 'quiet-sage', description: 'Muted warm sage/beige background — calm, natural, understated' },
  { id: 'deep-charcoal', description: 'Near-black background, light text — bold, modern, premium' },
  { id: 'midnight-slate', description: 'Dark slate background — professional, serious, high-end' },
  { id: 'rich-espresso', description: 'Deep brown background, cream text — cozy, artisanal, warm-dark' },
] as const

export const SHAPE_TOKENS = [
  { id: 'sharp-editorial', description: 'Square corners, wide letter-spacing, uppercase buttons — editorial/luxury' },
  { id: 'soft-modern', description: 'Rounded-md corners, clean shadows — modern SaaS/office feel' },
  { id: 'rounded-friendly', description: 'Fully rounded pill buttons/cards — approachable, friendly' },
  { id: 'structured-classic', description: 'Rounded-lg corners, soft shadows — classic, trustworthy' },
  { id: 'bold-block', description: 'Square corners, heavy uppercase buttons — bold, industrial' },
  { id: 'quiet-minimal', description: 'Square corners, wide tracking, minimal chrome — zen/minimalist' },
] as const

export const VOICE_TOKENS = [
  { id: 'luxe', description: 'Serif display font, elegant — luxury/high-end' },
  { id: 'editorial', description: 'Serif, warm and readable — classic/traditional trades' },
  { id: 'modernSans', description: 'Geometric sans — modern, tech-forward, corporate' },
  { id: 'boldDisplay', description: 'Heavy grotesque sans — bold, industrial, loud' },
  { id: 'playful', description: 'Rounded/quirky sans — friendly, family, playful' },
] as const

// hex mirrors the `hex` value of the matching key in custom-closets-websites'
// SWATCH table (lib/theme.ts) — used only for an accurate color preview chip
// in the intake review step; the renderer owns the real Tailwind classes.
export const SWATCH_TOKENS = [
  { id: 'amber', description: 'Warm amber/gold', hex: '#b45309' },
  { id: 'gold', description: 'Bright gold/yellow', hex: '#ca8a04' },
  { id: 'copper', description: 'Burnt orange/copper', hex: '#c2410c' },
  { id: 'bronze', description: 'Deep bronze brown', hex: '#92400e' },
  { id: 'blue', description: 'Classic corporate blue', hex: '#2563eb' },
  { id: 'indigo', description: 'Rich indigo/violet-blue', hex: '#4f46e5' },
  { id: 'teal', description: 'Teal/blue-green', hex: '#0d9488' },
  { id: 'cyan', description: 'Bright cyan/electric blue', hex: '#06b6d4' },
  { id: 'sky', description: 'Soft sky blue', hex: '#0284c7' },
  { id: 'emerald', description: 'Emerald green', hex: '#059669' },
  { id: 'green', description: 'Classic green', hex: '#15803d' },
  { id: 'rose', description: 'Soft rose/pink', hex: '#f43f5e' },
  { id: 'red', description: 'Bold red', hex: '#b91c1c' },
  { id: 'wine', description: 'Deep wine/burgundy', hex: '#8c2a35' },
  { id: 'purple', description: 'Rich purple', hex: '#9333ea' },
  { id: 'violet', description: 'Bright violet', hex: '#7c3aed' },
  { id: 'fuchsia', description: 'Vivid fuchsia/magenta', hex: '#d946ef' },
  { id: 'slate', description: 'Neutral slate grey', hex: '#475569' },
  { id: 'zen', description: 'Muted sage grey-green', hex: '#7d8276' },
] as const

export const SURFACE_IDS: string[] = SURFACE_TOKENS.map((t) => t.id)
export const SHAPE_IDS: string[] = SHAPE_TOKENS.map((t) => t.id)
export const VOICE_IDS: string[] = VOICE_TOKENS.map((t) => t.id)
export const SWATCH_IDS: string[] = SWATCH_TOKENS.map((t) => t.id)
export const SWATCH_HEX: Record<string, string> = Object.fromEntries(
  SWATCH_TOKENS.map((t) => [t.id, t.hex])
)
