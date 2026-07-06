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
  // New trade-vertical themes
  'fresh-clean',        // House & commercial cleaning
  'warm-handyman',      // Handyman & general repairs
  'rich-flooring',      // Flooring (hardwood, tile, carpet)
  'artisan-wood',       // Carpentry, cabinetry, custom woodwork
  'swift-mobile',       // Mobile / on-demand services (auto, locksmith)
  'clean-move',         // Moving & storage
  'urban-reclaim',      // Junk removal & hauling
  'stone-masonry',      // Concrete, masonry, hardscaping
  'appliance-pro',      // Appliance repair
  'care-comfort',       // Home health, caregiving, pet services
  // Second wave — new verticals
  'pool-resort',        // Pool & spa: aqua luxury
  'home-guardian',      // Home inspection & security systems
  'eco-solar',          // Solar & green energy
  'pastoral-pet',       // Pet services: friendly, warm
  'hearth-warm',        // Chimney, fireplace & heating
  'seasonal-outdoor',   // Irrigation, gutters, seasonal maintenance
  'garage-smart',       // Garage door & smart access
  'window-light',       // Window & door replacement
  // Third wave — 50 more industries
  'bold-remodel',       // Kitchen/bath remodeling — dramatic transformation
  'winter-ready',       // Snow removal & seasonal urgency
  'event-festive',      // Events, entertainment, catering, bounce houses
  'wellness-calm',      // Massage, personal training, self-care
  'fleet-logistics',    // Courier, freight, logistics, transport
  'media-creative',     // Photography, videography, drone, staging
  'gourmet-warm',       // Catering, personal chef, food truck
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
  // New layout types
  'emergency-first',    // Urgent / 24-7 trades: big CTA above fold, phone prominent
  'before-after',       // Cleaning / restoration: before-after photo grid
  'process-steps',      // Handyman / carpentry: numbered steps build trust
  'seasonal-cta',       // Seasonal services: opening/closing callouts + urgency
  'trust-report',       // Inspection/compliance — report summary + badge/cert display
  'service-zones',       // Logistics/delivery — zip-code/area focused for coverage
  'event-booking',      // Events/rentals — date-picker and package-selection focused
] as const

export type LayoutSlug = (typeof LAYOUT_SLUGS)[number]

export const DEFAULT_THEME: ThemeSlug = 'luxury-minimal'
export const DEFAULT_LAYOUT: LayoutSlug = 'standard'

/**
 * Layouts that deliberately render ONLY hero + quiz + widget sections (see
 * `renderLayout()`'s switch in custom-closets-websites/ClientPage.tsx) — no
 * About/Portfolio sections exist on these pages, so an anchor nav pointing to
 * `#about`/`#portfolio` would be dead links. Both `provisionTenant.ts` (single
 * -page anchor-nav fallback) and the site validator (nav_links emptiness
 * check) key off this SAME set so they never disagree about which layouts are
 * exempt from needing real nav content.
 */
export const MINIMAL_LAYOUTS_WITHOUT_ANCHOR_SECTIONS = new Set<LayoutSlug>([
  'minimalist-lead',
  'compact-quote',
])

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
  // New trade-vertical themes
  'fresh-clean': ['before-after', 'trust-builder', 'local-expert', 'conversion-focus', 'standard'],
  'warm-handyman': ['process-steps', 'trust-builder', 'local-expert', 'standard', 'conversion-focus'],
  'rich-flooring': ['gallery-showcase', 'portfolio-first', 'before-after', 'visual-impact', 'storyteller'],
  'artisan-wood': ['portfolio-first', 'gallery-showcase', 'storyteller', 'visual-impact', 'standard'],
  'swift-mobile': ['emergency-first', 'minimalist-lead', 'compact-quote', 'conversion-focus', 'trust-builder'],
  'clean-move': ['trust-builder', 'process-steps', 'local-expert', 'conversion-focus', 'standard'],
  'urban-reclaim': ['conversion-focus', 'minimalist-lead', 'compact-quote', 'trust-builder', 'local-expert'],
  'stone-masonry': ['portfolio-first', 'gallery-showcase', 'visual-impact', 'before-after', 'storyteller'],
  'appliance-pro': ['trust-builder', 'emergency-first', 'compact-quote', 'conversion-focus', 'standard'],
  'care-comfort': ['storyteller', 'trust-builder', 'local-expert', 'standard', 'process-steps'],
  // Second wave
  'pool-resort': ['gallery-showcase', 'visual-impact', 'portfolio-first', 'seasonal-cta', 'storyteller'],
  'home-guardian': ['trust-report', 'trust-builder', 'process-steps', 'standard', 'local-expert'],
  'eco-solar': ['trust-report', 'process-steps', 'conversion-focus', 'visual-impact', 'storyteller'],
  'pastoral-pet': ['storyteller', 'standard', 'local-expert', 'gallery-showcase', 'trust-builder'],
  'hearth-warm': ['portfolio-first', 'gallery-showcase', 'storyteller', 'trust-builder', 'before-after'],
  'seasonal-outdoor': ['seasonal-cta', 'local-expert', 'conversion-focus', 'trust-builder', 'standard'],
  'garage-smart': ['conversion-focus', 'emergency-first', 'compact-quote', 'trust-builder', 'process-steps'],
  'window-light': ['gallery-showcase', 'portfolio-first', 'before-after', 'visual-impact', 'conversion-focus'],
  // Third wave
  'bold-remodel': ['before-after', 'gallery-showcase', 'portfolio-first', 'visual-impact', 'storyteller'],
  'winter-ready': ['emergency-first', 'seasonal-cta', 'compact-quote', 'local-expert', 'minimalist-lead'],
  'event-festive': ['event-booking', 'gallery-showcase', 'storyteller', 'visual-impact', 'conversion-focus'],
  'wellness-calm': ['storyteller', 'trust-builder', 'standard', 'local-expert', 'process-steps'],
  'fleet-logistics': ['service-zones', 'minimalist-lead', 'compact-quote', 'trust-builder', 'conversion-focus'],
  'media-creative': ['gallery-showcase', 'portfolio-first', 'visual-impact', 'storyteller', 'standard'],
  'gourmet-warm': ['gallery-showcase', 'event-booking', 'storyteller', 'standard', 'conversion-focus'],
}
export const VIBE_TO_THEME: Record<string, ThemeSlug> = {
  'Luxury & minimal': 'luxury-minimal',
  'Bold & industrial': 'brutalist',
  'Warm & classic': 'classic-warm',
  'Modern & clean': 'modern-office',
  'Playful & friendly': 'playful-kids',
  'Rustic & natural': 'rustic-pantry',
  'Elegant & refined': 'elegant-dressing',
  'Sleek & high-tech': 'sleek-entertainment',
  'Fresh & spotless': 'fresh-clean',
  'Warm & trustworthy': 'warm-handyman',
  'Bold & fast': 'swift-mobile',
  'Artisan & crafted': 'artisan-wood',
  'Natural & earthy': 'stone-masonry',
  'Caring & personal': 'care-comfort',
  'Resort & luxury': 'pool-resort',
  'Safe & trusted': 'home-guardian',
  'Clean & sustainable': 'eco-solar',
  'Bright & airy': 'window-light',
  // Third wave vibes
  'Bold & transformative': 'bold-remodel',
  'Festive & energetic': 'event-festive',
  'Calm & restorative': 'wellness-calm',
  'Reliable & fast': 'fleet-logistics',
  'Creative & expressive': 'media-creative',
  'Warm & indulgent': 'gourmet-warm',
}

export const CTA_TO_LAYOUT: Record<string, LayoutSlug> = {
  'Book a free consultation': 'conversion-focus',
  'Request a quote': 'conversion-focus',
  'Call now': 'minimalist-lead',
  'Browse the portfolio': 'portfolio-first',
  'See our work': 'gallery-showcase',
  'Get emergency help': 'emergency-first',
  'See before & after': 'before-after',
  'How it works': 'process-steps',
  'Schedule seasonal service': 'seasonal-cta',
  'View inspection report': 'trust-report',
  'Book your event': 'event-booking',
  'Check service area': 'service-zones',
}
