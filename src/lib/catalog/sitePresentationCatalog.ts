/** Shared theme + layout slugs (keep in sync with custom-closets-websites ThemeType). */

export const THEME_SLUGS = [
  'luxury-minimal',
  'brutalist',
  'classic-warm',
  'modern-office',
  'playful-kids',
  'rustic-pantry',
  'sleek-entertainment',
  'elegant-dressing',
  'functional-utility',
  'creative-craft',
  'sophisticated-wine',
  'cozy-library',
  'minimalist-zen',
  'garage-industrial',
  'pantry-fresh',
  'laundry-clean',
  'mudroom-family',
  'commercial-pro',
  'coastal-climate',
  'historic-classic',
  'luxury-gallery',
  'kids-playful',
  'media-theater',
  'office-executive',
  'wine-cellar',
] as const

export type ThemeSlug = (typeof THEME_SLUGS)[number]

export const LAYOUT_SLUGS = [
  'standard',
  'portfolio-first',
  'conversion-focus',
  'storyteller',
  'minimalist-lead',
  'visual-impact',
  'trust-builder',
  'gallery-showcase',
  'local-expert',
  'compact-quote',
] as const

export type LayoutSlug = (typeof LAYOUT_SLUGS)[number]

export const DEFAULT_THEME: ThemeSlug = 'luxury-minimal'
export const DEFAULT_LAYOUT: LayoutSlug = 'standard'

export function isThemeSlug(v: string): v is ThemeSlug {
  return (THEME_SLUGS as readonly string[]).includes(v)
}

export function isLayoutSlug(v: string): v is LayoutSlug {
  return (LAYOUT_SLUGS as readonly string[]).includes(v)
}

export function coerceThemeSlug(v: string | null | undefined): ThemeSlug {
  if (v && isThemeSlug(v)) return v
  return DEFAULT_THEME
}

export function coerceLayoutSlug(v: string | null | undefined): LayoutSlug {
  if (v && isLayoutSlug(v)) return v
  return DEFAULT_LAYOUT
}

/** Layouts that pair best with each theme (used to narrow AI/rule pools). */
export const THEME_LAYOUT_AFFINITY: Record<ThemeSlug, LayoutSlug[]> = {
  'luxury-minimal': ['standard', 'portfolio-first', 'gallery-showcase', 'minimalist-lead', 'visual-impact'],
  brutalist: ['visual-impact', 'conversion-focus', 'portfolio-first', 'minimalist-lead', 'compact-quote'],
  'classic-warm': ['standard', 'storyteller', 'trust-builder', 'local-expert', 'conversion-focus'],
  'modern-office': ['standard', 'conversion-focus', 'compact-quote', 'trust-builder', 'minimalist-lead'],
  'playful-kids': ['storyteller', 'standard', 'conversion-focus', 'gallery-showcase'],
  'rustic-pantry': ['storyteller', 'standard', 'local-expert', 'gallery-showcase'],
  'sleek-entertainment': ['visual-impact', 'portfolio-first', 'gallery-showcase', 'minimalist-lead'],
  'elegant-dressing': ['portfolio-first', 'gallery-showcase', 'visual-impact', 'storyteller'],
  'functional-utility': ['standard', 'conversion-focus', 'trust-builder', 'compact-quote', 'local-expert'],
  'creative-craft': ['storyteller', 'gallery-showcase', 'standard', 'portfolio-first'],
  'sophisticated-wine': ['gallery-showcase', 'storyteller', 'portfolio-first', 'standard'],
  'cozy-library': ['storyteller', 'portfolio-first', 'local-expert', 'standard'],
  'minimalist-zen': ['minimalist-lead', 'standard', 'compact-quote', 'conversion-focus'],
  'garage-industrial': ['visual-impact', 'conversion-focus', 'portfolio-first', 'trust-builder'],
  'pantry-fresh': ['standard', 'storyteller', 'gallery-showcase', 'conversion-focus'],
  'laundry-clean': ['trust-builder', 'standard', 'conversion-focus', 'local-expert'],
  'mudroom-family': ['local-expert', 'conversion-focus', 'standard', 'storyteller'],
  'commercial-pro': ['trust-builder', 'conversion-focus', 'compact-quote', 'standard'],
  'coastal-climate': ['local-expert', 'portfolio-first', 'visual-impact', 'trust-builder'],
  'historic-classic': ['storyteller', 'trust-builder', 'local-expert', 'portfolio-first'],
  'luxury-gallery': ['gallery-showcase', 'portfolio-first', 'visual-impact', 'storyteller'],
  'kids-playful': ['storyteller', 'standard', 'conversion-focus', 'gallery-showcase'],
  'media-theater': ['visual-impact', 'portfolio-first', 'gallery-showcase', 'minimalist-lead'],
  'office-executive': ['trust-builder', 'conversion-focus', 'standard', 'storyteller'],
  'wine-cellar': ['gallery-showcase', 'storyteller', 'portfolio-first', 'visual-impact'],
}

/** Maps intake vibe answers to a theme hint (merged with service affinity). */
export const VIBE_TO_THEME: Record<string, ThemeSlug> = {
  'Luxury & minimal': 'luxury-minimal',
  'Bold & industrial': 'brutalist',
  'Warm & classic': 'classic-warm',
  'Modern & clean': 'modern-office',
  'Playful & friendly': 'playful-kids',
  'Rustic & natural': 'rustic-pantry',
  'Elegant & refined': 'elegant-dressing',
  'Sleek & high-tech': 'sleek-entertainment',
}

export const CTA_TO_LAYOUT: Record<string, LayoutSlug> = {
  'Book a free consultation': 'conversion-focus',
  'Request a quote': 'conversion-focus',
  'Call now': 'minimalist-lead',
  'Browse the portfolio': 'portfolio-first',
}
