import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const TOW_IMG = 'https://images.unsplash.com/photo-1545558014-8692077e9b5c'
const ROADSIDE_IMG = 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d'

function tow(
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
    industry: 'towing',
    keywords,
    widgetCategory: label,
    recommendedThemes: themes,
    recommendedLayouts: layouts,
    catalog,
  }
}

const URGENT_THEMES = ['brutalist', 'functional-utility', 'modern-office', 'garage-industrial'] as const
const URGENT_LAYOUTS = ['minimalist-lead', 'compact-quote', 'conversion-focus'] as const

export const TOWING_SERVICES: ServiceDef[] = [
  tow(
    'Light-Duty Towing',
    'Towing',
    [...URGENT_THEMES],
    [...URGENT_LAYOUTS],
    { image: TOW_IMG, description: 'Cars, SUVs, and light trucks towed safely.' },
    ['car tow', 'vehicle tow', 'breakdown tow']
  ),
  tow(
    'Heavy-Duty Towing',
    'Towing',
    ['brutalist', 'garage-industrial', 'commercial-pro', 'functional-utility'],
    [...URGENT_LAYOUTS, 'trust-builder'],
    { image: TOW_IMG, description: 'Semis, RVs, and heavy equipment recovery.' },
    ['semi tow', 'rv tow', 'heavy tow', 'diesel']
  ),
  tow(
    'Roadside Assistance',
    'Roadside',
    [...URGENT_THEMES],
    [...URGENT_LAYOUTS],
    { image: ROADSIDE_IMG, description: 'Jump starts, lockouts, and tire changes on the spot.' },
    ['jump start', 'lockout', 'flat tire', 'roadside']
  ),
  tow(
    'Accident Recovery',
    'Recovery',
    ['brutalist', 'functional-utility', 'commercial-pro', 'modern-office'],
    ['trust-builder', 'minimalist-lead', 'conversion-focus'],
    { image: TOW_IMG, description: 'Collision recovery coordinated with insurers.' },
    ['accident tow', 'collision', 'insurance tow']
  ),
  tow(
    'Winch-Out & Off-Road Recovery',
    'Recovery',
    ['brutalist', 'garage-industrial', 'coastal-climate', 'functional-utility'],
    [...URGENT_LAYOUTS, 'visual-impact'],
    { image: TOW_IMG, description: 'Stuck in mud, ditch, or snow? We winch you out.' },
    ['winch', 'off road', 'stuck', 'mud recovery']
  ),
  tow(
    'Flatbed Transport',
    'Transport',
    ['modern-office', 'sleek-entertainment', 'functional-utility', 'commercial-pro'],
    ['compact-quote', 'conversion-focus', 'trust-builder'],
    { image: TOW_IMG, description: 'Enclosed and flatbed transport for specialty vehicles.' },
    ['flatbed', 'classic car transport', 'exotic car']
  ),
  tow(
    'Motorcycle Towing',
    'Towing',
    [...URGENT_THEMES],
    [...URGENT_LAYOUTS],
    { image: TOW_IMG, description: 'Motorcycle-safe towing with proper tie-downs.' },
    ['bike tow', 'motorcycle recovery']
  ),
  tow(
    'Fleet & Commercial Towing',
    'Commercial',
    ['commercial-pro', 'brutalist', 'modern-office', 'functional-utility'],
    ['trust-builder', 'compact-quote', 'conversion-focus'],
    { image: TOW_IMG, description: 'Priority towing accounts for fleets and businesses.' },
    ['fleet', 'commercial account', 'dealership tow']
  ),
  tow(
    'Impound & Private Property Towing',
    'Commercial',
    ['commercial-pro', 'brutalist', 'functional-utility', 'modern-office'],
    ['trust-builder', 'local-expert', 'compact-quote'],
    { image: TOW_IMG, description: 'Private property and parking enforcement towing.' },
    ['impound', 'private property', 'parking lot']
  ),
  tow(
    'Long-Distance Towing',
    'Transport',
    ['modern-office', 'classic-warm', 'functional-utility', 'commercial-pro'],
    ['compact-quote', 'conversion-focus', 'storyteller'],
    { image: TOW_IMG, description: 'Cross-state vehicle transport with clear pricing.' },
    ['long distance', 'interstate', 'state to state']
  ),
]

export const TOWING_GROUPS = ['Towing', 'Roadside', 'Recovery', 'Transport', 'Commercial'] as const

export const TOWING_INDUSTRY: IndustryDef = {
  slug: 'towing',
  label: 'Towing',
  keywords: ['tow', 'towing', 'roadside', 'wrecker', 'vehicle recovery', 'roadside recovery'],
  serviceGroups: [...TOWING_GROUPS],
  defaultThemes: ['brutalist', 'functional-utility', 'garage-industrial', 'modern-office'],
  defaultLayouts: ['minimalist-lead', 'compact-quote', 'conversion-focus'],
  services: TOWING_SERVICES,
}
