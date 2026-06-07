import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const WASH_IMG = 'https://images.unsplash.com/photo-1581578731548-c64695cc6952'
const HOUSE_IMG = 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6'
const CONCRETE_IMG = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c'

function wash(
  label: string,
  group: string,
  themes: ServiceDef['recommendedThemes'],
  layouts: ServiceDef['recommendedLayouts'],
  catalog: ServiceDef['catalog'],
  keywords: string[] = []
): ServiceDef {
  return {
    label,
    group,
    industry: 'pressure-washing',
    keywords,
    widgetCategory: label,
    recommendedThemes: themes,
    recommendedLayouts: layouts,
    catalog,
  }
}

const CLEAN_THEMES = ['laundry-clean', 'coastal-climate', 'modern-office', 'minimalist-zen'] as const
const VISUAL_LAYOUTS = ['visual-impact', 'portfolio-first', 'gallery-showcase'] as const

export const PRESSURE_WASHING_SERVICES: ServiceDef[] = [
  wash(
    'House Washing',
    'Residential',
    [...CLEAN_THEMES, 'classic-warm'],
    [...VISUAL_LAYOUTS, 'conversion-focus'],
    { image: HOUSE_IMG, description: 'Soft-wash house exteriors without damage.' },
    ['house wash', 'siding clean', 'exterior wash']
  ),
  wash(
    'Driveway & Concrete Cleaning',
    'Hard surfaces',
    ['brutalist', 'garage-industrial', 'functional-utility', 'modern-office'],
    [...VISUAL_LAYOUTS, 'trust-builder'],
    { image: CONCRETE_IMG, description: 'Oil-stained driveways and sidewalks restored.' },
    ['driveway', 'concrete', 'sidewalk', 'patio clean']
  ),
  wash(
    'Deck & Fence Cleaning',
    'Wood',
    ['rustic-pantry', 'coastal-climate', 'classic-warm', 'historic-classic'],
    ['portfolio-first', 'storyteller', 'local-expert'],
    { image: WASH_IMG, description: 'Gentle cleaning and brightening for wood surfaces.' },
    ['deck wash', 'fence cleaning', 'wood restore']
  ),
  wash(
    'Roof Soft Wash',
    'Roof',
    ['coastal-climate', 'classic-warm', 'modern-office', 'functional-utility'],
    ['trust-builder', 'local-expert', 'conversion-focus'],
    { image: HOUSE_IMG, description: 'Algae-safe roof cleaning that protects shingles.' },
    ['roof wash', 'soft wash roof', 'algae']
  ),
  wash(
    'Commercial Pressure Washing',
    'Commercial',
    ['commercial-pro', 'brutalist', 'modern-office', 'functional-utility'],
    ['trust-builder', 'conversion-focus', 'compact-quote'],
    { image: CONCRETE_IMG, description: 'Storefronts, lots, and buildings on a schedule.' },
    ['commercial wash', 'storefront', 'parking lot']
  ),
  wash(
    'Gutter Brightening',
    'Gutters',
    [...CLEAN_THEMES],
    ['local-expert', 'conversion-focus', 'standard'],
    { image: HOUSE_IMG, description: 'Tiger stripes and oxidation removed from gutters.' },
    ['gutter cleaning', 'gutter brightening']
  ),
  wash(
    'Fleet & Equipment Washing',
    'Commercial',
    ['garage-industrial', 'brutalist', 'commercial-pro', 'functional-utility'],
    ['compact-quote', 'trust-builder', 'conversion-focus'],
    { image: WASH_IMG, description: 'Mobile washing for trucks, fleets, and equipment.' },
    ['fleet wash', 'truck wash', 'equipment cleaning']
  ),
  wash(
    'Pool Deck Cleaning',
    'Hard surfaces',
    ['coastal-climate', 'luxury-minimal', 'modern-office', 'sleek-entertainment'],
    ['visual-impact', 'gallery-showcase', 'portfolio-first'],
    { image: CONCRETE_IMG, description: 'Slip-safe pool decks and patios cleaned thoroughly.' },
    ['pool deck', 'pool patio']
  ),
  wash(
    'Graffiti Removal',
    'Specialty',
    ['brutalist', 'modern-office', 'functional-utility', 'commercial-pro'],
    ['minimalist-lead', 'conversion-focus', 'trust-builder'],
    { image: WASH_IMG, description: 'Fast graffiti removal for property managers.' },
    ['graffiti', 'tag removal']
  ),
  wash(
    'Rust & Stain Treatment',
    'Specialty',
    ['functional-utility', 'garage-industrial', 'modern-office', 'classic-warm'],
    ['trust-builder', 'conversion-focus', 'local-expert'],
    { image: CONCRETE_IMG, description: 'Targeted treatments for rust, fertilizer, and stains.' },
    ['rust stain', 'fertilizer stain', 'oil stain']
  ),
]

export const PRESSURE_WASHING_GROUPS = [
  'Residential',
  'Hard surfaces',
  'Wood',
  'Roof',
  'Commercial',
  'Gutters',
  'Specialty',
] as const

export const PRESSURE_WASHING_INDUSTRY: IndustryDef = {
  slug: 'pressure-washing',
  label: 'Pressure Washing',
  keywords: ['pressure wash', 'power wash', 'soft wash', 'house wash', 'exterior clean'],
  serviceGroups: [...PRESSURE_WASHING_GROUPS],
  defaultThemes: ['coastal-climate', 'laundry-clean', 'modern-office', 'functional-utility'],
  defaultLayouts: ['visual-impact', 'portfolio-first', 'conversion-focus', 'local-expert'],
  services: PRESSURE_WASHING_SERVICES,
}
