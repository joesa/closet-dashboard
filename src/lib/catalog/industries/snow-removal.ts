import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1551529834-525807d6b4f3'

function sn(label: string, group: string, themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry: 'snow-removal', keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['winter-ready', 'functional-utility', 'commercial-pro', 'swift-mobile'] as const
const L = ['seasonal-cta', 'compact-quote', 'emergency-first', 'local-expert'] as const

export const SNOW_REMOVAL_SERVICES: ServiceDef[] = [
  sn('Residential Snow Plowing', 'Plowing', [...T], [...L, 'conversion-focus'], { image: IMG, description: 'Driveway and walkway plowing — on-call or seasonal contract available.' }, ['snow plowing', 'driveway plowing', 'snow removal', 'plow service', 'residential snow']),
  sn('Commercial Snow Plowing', 'Commercial', ['commercial-pro', 'winter-ready', 'brutalist', 'functional-utility'], ['seasonal-cta', 'compact-quote', 'trust-builder', 'conversion-focus'], { image: IMG, description: 'Lot plowing, truck routes, and season contracts for businesses and HOAs.' }, ['commercial plowing', 'parking lot snow', 'commercial snow removal', 'fleet plowing']),
  sn('Ice & Salt Treatment', 'De-icing', [...T], ['emergency-first', 'compact-quote', 'seasonal-cta', 'local-expert'], { image: IMG, description: 'Pre-treatment and post-storm salting to prevent ice buildup.' }, ['ice treatment', 'salting', 'de-icing', 'anti-icing', 'salt service', 'calcium chloride']),
  sn('Sidewalk Snow Removal', 'Walks', ['winter-ready', 'functional-utility', 'swift-mobile', 'classic-warm'], ['compact-quote', 'local-expert', 'seasonal-cta', 'conversion-focus'], { image: IMG, description: 'Manual shoveling and snow blowing for sidewalks, steps, and entries.' }, ['sidewalk shoveling', 'walkway snow', 'shovel service', 'snow blowing']),
  sn('Roof Snow Removal', 'Roof', ['winter-ready', 'functional-utility', 'classic-warm', 'commercial-pro'], ['emergency-first', 'trust-builder', 'compact-quote', 'seasonal-cta'], { image: IMG, description: 'Safe roof snow and ice dam removal to prevent structural damage and leaks.' }, ['roof snow removal', 'ice dam removal', 'roof clearing', 'snow off roof']),
  sn('Seasonal Snow Contract', 'Contracts', ['commercial-pro', 'winter-ready', 'functional-utility', 'modern-office'], ['trust-builder', 'compact-quote', 'seasonal-cta', 'conversion-focus'], { image: IMG, description: 'Per-push, per-inch, or seasonal flat-rate contracts for peace of mind all winter.' }, ['snow contract', 'seasonal contract', 'per push', 'winter contract', 'snow management']),
]

export const SNOW_REMOVAL_INDUSTRY: IndustryDef = {
  slug: 'snow-removal', label: 'Snow Removal',
  keywords: ['snow removal', 'snow plowing', 'snow plow', 'ice removal', 'salting', 'de-icing', 'snow service'],
  serviceGroups: ['Plowing', 'Commercial', 'De-icing', 'Walks', 'Roof', 'Contracts'],
  defaultThemes: ['winter-ready', 'functional-utility', 'commercial-pro', 'swift-mobile'],
  defaultLayouts: ['seasonal-cta', 'compact-quote', 'emergency-first', 'local-expert'],
  services: SNOW_REMOVAL_SERVICES,
}
