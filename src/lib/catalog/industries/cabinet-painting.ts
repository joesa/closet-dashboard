import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136'

function cab(label: string, group: string, themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry: 'cabinet-painting', keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['bold-remodel', 'artisan-wood', 'classic-warm', 'luxury-minimal'] as const
const L = ['before-after', 'gallery-showcase', 'portfolio-first', 'conversion-focus'] as const

export const CABINET_PAINTING_SERVICES: ServiceDef[] = [
  cab('Cabinet Painting & Refinishing', 'Painting', [...T], [...L, 'storyteller'], { image: IMG, description: 'Professional cabinet painting with a factory-smooth finish — no spray dust.' }, ['cabinet painting', 'cabinet refinish', 'paint cabinets', 'kitchen cabinet paint']),
  cab('Cabinet Refacing', 'Refacing', ['bold-remodel', 'artisan-wood', 'classic-warm', 'modern-office'], ['before-after', 'gallery-showcase', 'portfolio-first', 'visual-impact'], { image: IMG, description: 'New doors, drawer fronts, and veneer over existing cabinet boxes.' }, ['cabinet refacing', 'reface cabinets', 'new cabinet doors', 'cabinet door replacement']),
  cab('Cabinet Hardware Update', 'Hardware', ['bold-remodel', 'classic-warm', 'luxury-minimal', 'modern-office'], ['before-after', 'compact-quote', 'conversion-focus', 'gallery-showcase'], { image: IMG, description: 'Knobs, pulls, and hinges swapped out for an instant kitchen upgrade.' }, ['cabinet hardware', 'cabinet pulls', 'cabinet knobs', 'hinge replacement', 'cabinet update']),
  cab('Bathroom Vanity Refresh', 'Vanity', ['bold-remodel', 'luxury-minimal', 'classic-warm', 'minimalist-zen'], ['before-after', 'gallery-showcase', 'portfolio-first', 'conversion-focus'], { image: IMG, description: 'Vanity cabinet painting, new doors, and hardware for a bathroom transformation.' }, ['vanity painting', 'bathroom vanity refinish', 'paint vanity', 'vanity refresh']),
  cab('New Cabinet Installation', 'Installation', ['bold-remodel', 'artisan-wood', 'classic-warm', 'luxury-minimal'], ['gallery-showcase', 'portfolio-first', 'before-after', 'visual-impact'], { image: IMG, description: 'Stock, semi-custom, and custom cabinet installation in kitchens and baths.' }, ['cabinet installation', 'install cabinets', 'new cabinets', 'kitchen cabinet install', 'shaker cabinets']),
]

export const CABINET_PAINTING_INDUSTRY: IndustryDef = {
  slug: 'cabinet-painting', label: 'Cabinet Painting & Refacing',
  keywords: ['cabinet painting', 'cabinet refacing', 'paint cabinets', 'cabinet refinish', 'new cabinet doors', 'cabinet refresh'],
  serviceGroups: ['Painting', 'Refacing', 'Hardware', 'Vanity', 'Installation'],
  defaultThemes: ['bold-remodel', 'artisan-wood', 'classic-warm', 'luxury-minimal'],
  defaultLayouts: ['before-after', 'gallery-showcase', 'portfolio-first', 'conversion-focus'],
  services: CABINET_PAINTING_SERVICES,
}
