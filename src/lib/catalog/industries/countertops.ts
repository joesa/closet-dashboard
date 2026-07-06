import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136'

function ct(label: string, group: string, themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry: 'countertops', keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['bold-remodel', 'luxury-minimal', 'artisan-wood', 'classic-warm'] as const
const L = ['gallery-showcase', 'before-after', 'portfolio-first', 'conversion-focus'] as const

export const COUNTERTOPS_SERVICES: ServiceDef[] = [
  ct('Granite Countertops', 'Stone', [...T, 'rustic-pantry'], [...L, 'visual-impact'], { image: IMG, description: 'Natural granite countertops fabricated and installed for kitchens and bathrooms.' }, ['granite countertop', 'granite install', 'granite slab', 'granite kitchen']),
  ct('Quartz Countertops', 'Stone', ['bold-remodel', 'luxury-minimal', 'minimalist-zen', 'modern-office'], ['gallery-showcase', 'visual-impact', 'before-after', 'portfolio-first'], { image: IMG, description: 'Engineered quartz in hundreds of colors — durable, non-porous, and beautiful.' }, ['quartz countertop', 'silestone', 'caesarstone', 'quartz install', 'engineered stone']),
  ct('Marble Countertops', 'Stone', ['luxury-minimal', 'elegant-dressing', 'bold-remodel', 'sophisticated-wine'], ['gallery-showcase', 'visual-impact', 'portfolio-first', 'storyteller'], { image: IMG, description: 'Carrara, Calacatta, and honed marble countertops for timeless interiors.' }, ['marble countertop', 'carrara marble', 'marble install', 'marble kitchen', 'honed marble']),
  ct('Butcher Block Countertops', 'Wood', ['artisan-wood', 'rustic-pantry', 'classic-warm', 'bold-remodel'], ['portfolio-first', 'gallery-showcase', 'before-after', 'storyteller'], { image: IMG, description: 'End-grain and edge-grain butcher block installed and finished to spec.' }, ['butcher block', 'wood countertop', 'walnut countertop', 'butcher block install']),
  ct('Laminate & Budget Countertops', 'Budget', ['classic-warm', 'warm-handyman', 'functional-utility', 'bold-remodel'], ['before-after', 'compact-quote', 'conversion-focus', 'trust-builder'], { image: IMG, description: 'Formica, Wilsonart, and custom laminate countertops that stretch any budget.' }, ['laminate countertop', 'formica', 'wilsonart', 'cheap countertop', 'countertop replacement']),
  ct('Concrete Countertops', 'Specialty', ['artisan-wood', 'stone-masonry', 'bold-remodel', 'minimalist-zen'], ['portfolio-first', 'visual-impact', 'gallery-showcase', 'storyteller'], { image: IMG, description: 'Custom poured and hand-finished concrete countertops for any design style.' }, ['concrete countertop', 'custom concrete counter', 'cement countertop']),
  ct('Countertop Repair & Resurfacing', 'Repair', ['bold-remodel', 'warm-handyman', 'classic-warm', 'functional-utility'], ['before-after', 'compact-quote', 'trust-builder', 'conversion-focus'], { image: IMG, description: 'Chips, cracks, burns, and delamination repaired without full replacement.' }, ['countertop repair', 'chip repair', 'countertop resurface', 'laminate repair']),
]

export const COUNTERTOPS_INDUSTRY: IndustryDef = {
  slug: 'countertops', label: 'Countertop Installation',
  keywords: ['countertops', 'granite countertop', 'quartz countertop', 'countertop install', 'countertop replacement', 'kitchen countertop'],
  serviceGroups: ['Stone', 'Wood', 'Budget', 'Specialty', 'Repair'],
  defaultThemes: ['bold-remodel', 'luxury-minimal', 'artisan-wood', 'classic-warm'],
  defaultLayouts: ['gallery-showcase', 'before-after', 'portfolio-first', 'conversion-focus'],
  services: COUNTERTOPS_SERVICES,
}
