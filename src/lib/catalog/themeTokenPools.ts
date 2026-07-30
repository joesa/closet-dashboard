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
 *
 * One deliberate asymmetry: the renderer's SWATCH is a superset of SWATCH_TOKENS
 * below. Every id offered here must exist there, but the renderer also keeps
 * retired ids alive so already-published sites keep their colour. Adding an id
 * here without adding it there falls back to `slate` at render time.
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
// Offered to new builds only. `indigo`, `violet`, `purple`, `fuchsia` and `cyan`
// are deliberately NOT here: they are Tailwind's default ramp values, and
// FULL_REDESIGN_DESIGN_SYSTEM bans the indigo/violet SaaS look outright, so the
// pool must not keep offering it. The renderer still defines those keys, because
// sites published before this change render from them and must not shift colour.
export const SWATCH_TOKENS = [
  { id: 'amber', description: 'Warm amber/gold', hex: '#b45309' },
  { id: 'gold', description: 'Bright gold/yellow', hex: '#ca8a04' },
  { id: 'copper', description: 'Burnt orange/copper', hex: '#c2410c' },
  { id: 'bronze', description: 'Deep bronze brown', hex: '#92400e' },
  { id: 'brass', description: 'Aged brass — warm metallic neutral', hex: '#8a7256' },
  { id: 'clay', description: 'Fired clay / terracotta red-brown', hex: '#96482f' },
  { id: 'ochre', description: 'Dark ochre — earthy mustard', hex: '#8a6a1f' },
  { id: 'blue', description: 'Classic corporate blue', hex: '#2563eb' },
  { id: 'denim', description: 'Workwear denim — muted navy-blue', hex: '#35506b' },
  { id: 'teal', description: 'Teal/blue-green', hex: '#0d9488' },
  { id: 'sky', description: 'Soft sky blue', hex: '#0284c7' },
  { id: 'emerald', description: 'Emerald green', hex: '#059669' },
  { id: 'green', description: 'Classic green', hex: '#15803d' },
  { id: 'pine', description: 'Deep pine — forest green, low chroma', hex: '#2f4f43' },
  { id: 'rose', description: 'Soft rose/pink', hex: '#f43f5e' },
  { id: 'red', description: 'Bold red', hex: '#b91c1c' },
  { id: 'wine', description: 'Deep wine/burgundy', hex: '#8c2a35' },
  { id: 'oxblood', description: 'Oxblood — dark brick red, leather-bound', hex: '#6b2733' },
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
