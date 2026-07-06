import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const CLEAN_IMG = 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac'
const CARPET_IMG = 'https://images.unsplash.com/photo-1558317374-067fb5f30001'
const WINDOW_IMG = 'https://images.unsplash.com/photo-1581578731548-c64695cc6952'
const PRESSURE_IMG = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64'

function clean(
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
    industry: 'cleaning',
    keywords,
    widgetCategory: label,
    recommendedThemes: themes,
    recommendedLayouts: layouts,
    catalog,
  }
}

const CLEAN_THEMES = ['fresh-clean', 'minimalist-zen', 'classic-warm', 'laundry-clean'] as const
const CLEAN_LAYOUTS = ['before-after', 'trust-builder', 'local-expert', 'conversion-focus'] as const

export const CLEANING_SERVICES: ServiceDef[] = [
  clean(
    'Regular House Cleaning',
    'Residential',
    [...CLEAN_THEMES],
    [...CLEAN_LAYOUTS, 'standard'],
    { image: CLEAN_IMG, description: 'Weekly, bi-weekly, or monthly maid service for a spotless home.' },
    ['maid', 'housekeeping', 'recurring clean', 'house cleaner', 'weekly clean']
  ),
  clean(
    'Deep Cleaning',
    'Residential',
    ['fresh-clean', 'classic-warm', 'minimalist-zen', 'functional-utility'],
    ['before-after', 'conversion-focus', 'trust-builder'],
    { image: CLEAN_IMG, description: 'Top-to-bottom deep clean including baseboards, appliances, and grout.' },
    ['deep clean', 'thorough clean', 'one-time clean', 'move-in clean', 'move-out clean']
  ),
  clean(
    'Move-In / Move-Out Cleaning',
    'Residential',
    ['fresh-clean', 'minimalist-zen', 'laundry-clean', 'classic-warm'],
    ['conversion-focus', 'compact-quote', 'trust-builder', 'local-expert'],
    { image: CLEAN_IMG, description: 'Rental-ready cleans that satisfy landlords and impress new owners.' },
    ['move out', 'move in', 'rental clean', 'end of lease', 'turnover clean']
  ),
  clean(
    'Carpet & Upholstery Cleaning',
    'Specialty',
    ['fresh-clean', 'classic-warm', 'warm-handyman', 'laundry-clean'],
    ['before-after', 'trust-builder', 'conversion-focus'],
    { image: CARPET_IMG, description: 'Hot-water extraction and dry-cleaning for carpets and furniture.' },
    ['carpet steam', 'rug cleaning', 'sofa clean', 'upholstery steam', 'carpet shampoo']
  ),
  clean(
    'Window Cleaning',
    'Specialty',
    ['fresh-clean', 'minimalist-zen', 'coastal-climate', 'classic-warm'],
    ['before-after', 'local-expert', 'trust-builder'],
    { image: WINDOW_IMG, description: 'Streak-free interior and exterior window cleaning.' },
    ['window wash', 'glass cleaning', 'window washer']
  ),
  clean(
    'Post-Construction Cleaning',
    'Specialty',
    ['functional-utility', 'commercial-pro', 'fresh-clean', 'modern-office'],
    ['conversion-focus', 'trust-builder', 'compact-quote'],
    { image: CLEAN_IMG, description: 'Debris, dust, and sticker removal after renovations or new builds.' },
    ['construction clean', 'builder clean', 'renovation clean', 'new build clean']
  ),
  clean(
    'Commercial Office Cleaning',
    'Commercial',
    ['commercial-pro', 'fresh-clean', 'modern-office', 'minimalist-zen'],
    ['trust-builder', 'conversion-focus', 'compact-quote', 'local-expert'],
    { image: CLEAN_IMG, description: 'Nightly or weekly janitorial service for offices and retail spaces.' },
    ['janitorial', 'office clean', 'commercial clean', 'business clean']
  ),
  clean(
    'Exterior / Pressure Washing',
    'Specialty',
    ['fresh-clean', 'functional-utility', 'garage-industrial', 'coastal-climate'],
    ['before-after', 'conversion-focus', 'local-expert'],
    { image: PRESSURE_IMG, description: 'Power washing for driveways, siding, decks, and fences.' },
    ['pressure wash', 'power wash', 'soft wash', 'driveway clean', 'house wash']
  ),
  clean(
    'Airbnb / Short-Term Rental Cleaning',
    'Residential',
    ['fresh-clean', 'minimalist-zen', 'laundry-clean', 'modern-office'],
    ['compact-quote', 'conversion-focus', 'trust-builder'],
    { image: CLEAN_IMG, description: 'Fast turnovers between guests — hotel-quality every time.' },
    ['airbnb clean', 'vrbo clean', 'vacation rental clean', 'turnover', 'short term rental']
  ),
]

export const CLEANING_INDUSTRY: IndustryDef = {
  slug: 'cleaning',
  label: 'Cleaning Services',
  keywords: ['cleaning', 'maid', 'janitorial', 'housekeeping', 'sanitation'],
  serviceGroups: ['Residential', 'Specialty', 'Commercial'],
  defaultThemes: ['fresh-clean', 'minimalist-zen', 'classic-warm', 'laundry-clean'],
  defaultLayouts: ['before-after', 'trust-builder', 'local-expert', 'conversion-focus'],
  services: CLEANING_SERVICES,
}
