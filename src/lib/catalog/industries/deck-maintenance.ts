import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1558981852-426c349dafd0'

function dk(label: string, group: string, themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry: 'deck-maintenance', keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['artisan-wood', 'rustic-pantry', 'classic-warm', 'coastal-climate'] as const
const L = ['before-after', 'seasonal-cta', 'portfolio-first', 'conversion-focus'] as const

export const DECK_MAINTENANCE_SERVICES: ServiceDef[] = [
  dk('Deck Staining & Sealing', 'Staining', [...T], [...L, 'local-expert'], { image: IMG, description: 'Solid stain, semi-transparent, and clear sealer applied to restore and protect wood.' }, ['deck staining', 'deck sealing', 'stain deck', 'deck finish', 'wood stain deck']),
  dk('Deck Power Washing & Cleaning', 'Cleaning', ['artisan-wood', 'fresh-clean', 'classic-warm', 'coastal-climate'], ['before-after', 'seasonal-cta', 'compact-quote', 'local-expert'], { image: IMG, description: 'Pressure washing, brightening, and prep for a pristine clean or before staining.' }, ['deck cleaning', 'deck power wash', 'deck wash', 'deck pressure wash']),
  dk('Deck Board Replacement', 'Repair', ['artisan-wood', 'classic-warm', 'functional-utility', 'warm-handyman'], ['before-after', 'trust-builder', 'compact-quote', 'local-expert'], { image: IMG, description: 'Rotted, warped, or cracked deck boards replaced with composite or hardwood.' }, ['deck board replacement', 'rotted deck boards', 'deck repair', 'replace deck boards']),
  dk('Fence Staining & Painting', 'Fences', ['artisan-wood', 'rustic-pantry', 'classic-warm', 'functional-utility'], ['before-after', 'seasonal-cta', 'compact-quote', 'local-expert'], { image: IMG, description: 'Wood fence staining, painting, and preservative treatment for years of protection.' }, ['fence staining', 'fence painting', 'stain fence', 'paint fence', 'fence treatment']),
  dk('Dock & Pier Treatment', 'Marine', ['coastal-climate', 'rustic-pantry', 'artisan-wood', 'pool-resort'], ['before-after', 'seasonal-cta', 'portfolio-first', 'local-expert'], { image: IMG, description: 'Marine-grade staining, sealing, and board replacement for docks and piers.' }, ['dock staining', 'pier treatment', 'dock maintenance', 'dock sealing']),
  dk('Deck Restoration', 'Restoration', ['artisan-wood', 'bold-remodel', 'rustic-pantry', 'classic-warm'], ['before-after', 'gallery-showcase', 'storyteller', 'conversion-focus'], { image: IMG, description: 'Complete deck restoration — cleaning, sanding, repair, and refinishing.' }, ['deck restoration', 'deck refinishing', 'restore deck', 'deck makeover']),
]

export const DECK_MAINTENANCE_INDUSTRY: IndustryDef = {
  slug: 'deck-maintenance', label: 'Deck Maintenance & Staining',
  keywords: ['deck', 'deck staining', 'deck sealing', 'deck maintenance', 'deck cleaning', 'deck repair', 'fence staining'],
  serviceGroups: ['Staining', 'Cleaning', 'Repair', 'Fences', 'Marine', 'Restoration'],
  defaultThemes: ['artisan-wood', 'rustic-pantry', 'classic-warm', 'coastal-climate'],
  defaultLayouts: ['before-after', 'seasonal-cta', 'portfolio-first', 'conversion-focus'],
  services: DECK_MAINTENANCE_SERVICES,
}
