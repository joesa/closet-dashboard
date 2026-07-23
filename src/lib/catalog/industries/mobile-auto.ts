import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const AUTO_IMG = 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f'
const DETAIL_IMG = 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7'
const GLASS_IMG = 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d'

function auto(
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
    industry: 'mobile-auto',
    keywords,
    widgetCategory: label,
    recommendedThemes: themes,
    recommendedLayouts: layouts,
    catalog,
  }
}

const MOBILE_THEMES = ['swift-mobile', 'brutalist', 'garage-industrial', 'modern-office'] as const
const MOBILE_LAYOUTS = ['emergency-first', 'minimalist-lead', 'compact-quote', 'conversion-focus'] as const

export const MOBILE_AUTO_SERVICES: ServiceDef[] = [
  auto(
    'Mobile Auto Detailing',
    'Detailing',
    ['swift-mobile', 'fresh-clean', 'luxury-minimal', 'garage-industrial'],
    ['visual-impact', 'portfolio-first', 'gallery-showcase', 'conversion-focus'],
    { image: DETAIL_IMG, description: 'Showroom-quality detailing at your home or office parking lot.' },
    ['auto detail', 'car detail', 'mobile detail', 'paint correction']
  ),
  auto(
    'Ceramic Coating',
    'Detailing',
    ['luxury-minimal', 'swift-mobile', 'fresh-clean', 'modern-office'],
    ['visual-impact', 'gallery-showcase', 'portfolio-first', 'conversion-focus'],
    { image: DETAIL_IMG, description: 'Professional-grade ceramic coating for years of paint protection.' },
    ['ceramic coat', 'paint protection', 'ppf', 'nano coating']
  ),
  auto(
    'Mobile Windshield Repair & Replacement',
    'Glass',
    [...MOBILE_THEMES],
    [...MOBILE_LAYOUTS],
    { image: GLASS_IMG, description: 'Rock chips and cracked windshields repaired or replaced on location.' },
    ['windshield repair', 'auto glass', 'chip repair', 'windshield replacement', 'crack repair']
  ),
  auto(
    'Mobile Tire Service',
    'Roadside',
    [...MOBILE_THEMES],
    [...MOBILE_LAYOUTS],
    { image: AUTO_IMG, description: 'Flat tire? We come to you — repair, rotate, and replace on-site.' },
    ['flat tire', 'mobile tire', 'tire repair', 'tire change', 'tire rotation']
  ),
  auto(
    'Mobile Oil Change & Maintenance',
    'Maintenance',
    ['swift-mobile', 'modern-office', 'garage-industrial', 'functional-utility'],
    ['compact-quote', 'conversion-focus', 'trust-builder', 'minimalist-lead'],
    { image: AUTO_IMG, description: 'Oil changes, filters, and basic maintenance at your location.' },
    ['mobile oil change', 'oil change at home', 'oil change service', 'mobile mechanic', 'basic service']
  ),
  auto(
    'Mobile Battery Service',
    'Roadside',
    [...MOBILE_THEMES],
    [...MOBILE_LAYOUTS],
    { image: AUTO_IMG, description: 'Dead battery? We test, jump-start, or replace it on the spot.' },
    ['jump start', 'dead battery', 'battery replacement', 'car battery', 'battery test']
  ),
  auto(
    'Mobile Vehicle Inspection',
    'Inspection',
    ['swift-mobile', 'modern-office', 'commercial-pro', 'functional-utility'],
    ['trust-builder', 'compact-quote', 'conversion-focus', 'local-expert'],
    { image: AUTO_IMG, description: 'Pre-purchase and annual inspections delivered to any location.' },
    ['car inspection', 'vehicle inspection', 'pre purchase inspection', 'ppi', 'safety check']
  ),
  auto(
    'Mobile Dent & Scratch Repair',
    'Body Work',
    ['swift-mobile', 'luxury-minimal', 'fresh-clean', 'garage-industrial'],
    ['before-after', 'portfolio-first', 'gallery-showcase', 'conversion-focus'],
    { image: AUTO_IMG, description: 'Paintless dent repair and scratch touch-ups done at your door.' },
    ['dent repair', 'pdr', 'paintless dent', 'scratch repair', 'door ding']
  ),
  auto(
    'Window Tinting',
    'Detailing',
    ['swift-mobile', 'fresh-clean', 'luxury-minimal', 'garage-industrial'],
    ['visual-impact', 'gallery-showcase', 'portfolio-first', 'conversion-focus'],
    { image: DETAIL_IMG, description: 'Ceramic and film window tinting for privacy, heat rejection, and style.' },
    ['window tint', 'window tinting', 'ceramic tint', 'window film', 'tint install']
  ),
  auto(
    'Car Wash',
    'Detailing',
    ['swift-mobile', 'fresh-clean', 'garage-industrial', 'modern-office'],
    ['service-zones', 'compact-quote', 'conversion-focus', 'gallery-showcase'],
    { image: DETAIL_IMG, description: 'Exterior wash, tunnel, and self-serve car wash bays with membership plans.' },
    ['car wash', 'car wash tunnel', 'self serve car wash', 'auto wash', 'wash membership']
  ),
]

export const MOBILE_AUTO_INDUSTRY: IndustryDef = {
  slug: 'mobile-auto',
  label: 'Mobile Auto Services',
  keywords: ['mobile auto', 'auto detailing', 'mobile mechanic', 'auto glass', 'car service', 'mobile car', 'ppf', 'paint protection film', 'window tint', 'window tinting', 'ceramic coating', 'car wash'],
  serviceGroups: ['Detailing', 'Glass', 'Roadside', 'Maintenance', 'Inspection', 'Body Work'],
  defaultThemes: ['swift-mobile', 'brutalist', 'garage-industrial', 'modern-office'],
  defaultLayouts: ['emergency-first', 'minimalist-lead', 'compact-quote', 'conversion-focus'],
  services: MOBILE_AUTO_SERVICES,
}
