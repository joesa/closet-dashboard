import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136'

function rm(label: string, group: string, industry: 'bathroom-remodel' | 'kitchen-remodel', themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry, keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['bold-remodel', 'luxury-minimal', 'artisan-wood', 'classic-warm'] as const
const L = ['gallery-showcase', 'before-after', 'portfolio-first', 'storyteller'] as const

export const BATHROOM_REMODEL_SERVICES: ServiceDef[] = [
  rm('Full Bathroom Remodel', 'Full Remodel', 'bathroom-remodel', [...T], [...L, 'visual-impact'], { image: IMG, description: 'Complete bathroom gut-and-rebuild — tile, vanity, shower, and fixtures.' }, ['bathroom remodel', 'full bathroom renovation', 'bathroom gut', 'bath remodel']),
  rm('Shower Replacement & Installation', 'Shower', 'bathroom-remodel', ['bold-remodel', 'luxury-minimal', 'minimalist-zen', 'classic-warm'], ['gallery-showcase', 'before-after', 'portfolio-first', 'visual-impact'], { image: IMG, description: 'Walk-in shower builds, tile surrounds, frameless glass, and shower pans.' }, ['shower install', 'new shower', 'walk-in shower', 'shower tile', 'frameless shower']),
  rm('Bathtub Replacement', 'Tub', 'bathroom-remodel', ['bold-remodel', 'classic-warm', 'luxury-minimal', 'artisan-wood'], ['before-after', 'gallery-showcase', 'portfolio-first', 'conversion-focus'], { image: IMG, description: 'Freestanding, alcove, and soaking tub installation and surround tile.' }, ['bathtub replacement', 'new bathtub', 'tub replacement', 'freestanding tub', 'soaking tub']),
  rm('Bathroom Tile Installation', 'Tile', 'bathroom-remodel', ['bold-remodel', 'luxury-minimal', 'minimalist-zen', 'stone-masonry'], ['gallery-showcase', 'visual-impact', 'before-after', 'portfolio-first'], { image: IMG, description: 'Floor tile, shower wall tile, and decorative accent tile installation.' }, ['bathroom tile', 'shower tile', 'floor tile bathroom', 'tile installation', 'mosaic tile']),
  rm('Vanity & Fixture Upgrade', 'Fixtures', 'bathroom-remodel', ['bold-remodel', 'modern-office', 'luxury-minimal', 'classic-warm'], ['before-after', 'compact-quote', 'conversion-focus', 'gallery-showcase'], { image: IMG, description: 'Vanity, faucet, mirror, and lighting upgrades for a fast bathroom refresh.' }, ['vanity install', 'bathroom vanity', 'faucet install', 'bathroom fixtures', 'medicine cabinet']),
]

export const KITCHEN_REMODEL_SERVICES: ServiceDef[] = [
  rm('Full Kitchen Remodel', 'Full Remodel', 'kitchen-remodel', [...T], [...L, 'visual-impact'], { image: IMG, description: 'Complete kitchen renovation — cabinets, counters, appliances, and layout.' }, ['kitchen remodel', 'kitchen renovation', 'full kitchen gut', 'kitchen makeover']),
  rm('Kitchen Cabinet Installation', 'Cabinets', 'kitchen-remodel', ['bold-remodel', 'artisan-wood', 'classic-warm', 'luxury-minimal'], ['gallery-showcase', 'before-after', 'portfolio-first', 'visual-impact'], { image: IMG, description: 'Custom, semi-custom, and stock kitchen cabinet installation and layout.' }, ['kitchen cabinet install', 'new kitchen cabinets', 'shaker cabinets', 'cabinet layout']),
  rm('Kitchen Backsplash', 'Tile', 'kitchen-remodel', ['bold-remodel', 'luxury-minimal', 'rustic-pantry', 'artisan-wood'], ['gallery-showcase', 'before-after', 'visual-impact', 'portfolio-first'], { image: IMG, description: 'Subway tile, herringbone, and custom mosaic backsplash installations.' }, ['backsplash install', 'kitchen backsplash', 'subway tile backsplash', 'tile backsplash']),
  rm('Kitchen Island Addition', 'Layout', 'kitchen-remodel', ['bold-remodel', 'artisan-wood', 'luxury-minimal', 'classic-warm'], ['gallery-showcase', 'portfolio-first', 'storyteller', 'visual-impact'], { image: IMG, description: 'Custom kitchen islands built for prep space, storage, and seating.' }, ['kitchen island', 'kitchen island build', 'island addition', 'kitchen island install']),
  rm('Appliance Installation', 'Appliances', 'kitchen-remodel', ['bold-remodel', 'modern-office', 'functional-utility', 'classic-warm'], ['compact-quote', 'trust-builder', 'before-after', 'conversion-focus'], { image: IMG, description: 'Dishwasher, range hood, and built-in appliance installation in remodels.' }, ['appliance install', 'kitchen appliances', 'range hood install', 'dishwasher install', 'refrigerator install']),
]

export const BATHROOM_REMODEL_INDUSTRY: IndustryDef = {
  slug: 'bathroom-remodel', label: 'Bathroom Remodeling',
  keywords: ['bathroom remodel', 'bathroom renovation', 'shower install', 'bathroom tile', 'vanity install', 'bath remodel', 'remodeling contractor', 'renovation contractor', 'general remodeling', 'home renovation'],
  serviceGroups: ['Full Remodel', 'Shower', 'Tub', 'Tile', 'Fixtures'],
  defaultThemes: ['bold-remodel', 'luxury-minimal', 'artisan-wood', 'classic-warm'],
  defaultLayouts: ['gallery-showcase', 'before-after', 'portfolio-first', 'storyteller'],
  services: BATHROOM_REMODEL_SERVICES,
}

export const KITCHEN_REMODEL_INDUSTRY: IndustryDef = {
  slug: 'kitchen-remodel', label: 'Kitchen Remodeling',
  keywords: ['kitchen remodel', 'kitchen renovation', 'kitchen cabinets', 'kitchen countertop', 'kitchen backsplash', 'kitchen island'],
  serviceGroups: ['Full Remodel', 'Cabinets', 'Tile', 'Layout', 'Appliances'],
  defaultThemes: ['bold-remodel', 'luxury-minimal', 'artisan-wood', 'classic-warm'],
  defaultLayouts: ['gallery-showcase', 'before-after', 'portfolio-first', 'storyteller'],
  services: KITCHEN_REMODEL_SERVICES,
}
