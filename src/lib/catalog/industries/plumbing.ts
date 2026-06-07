import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const PLUMBING_IMG = 'https://images.unsplash.com/photo-1607472586893-ad937548c171'
const DRAIN_IMG = 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7'
const WATER_HEATER_IMG = 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e'
const BATH_IMG = 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef06'
const PIPE_IMG = 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1'

function plumb(
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
    industry: 'plumbing',
    keywords,
    widgetCategory: label,
    recommendedThemes: themes,
    recommendedLayouts: layouts,
    catalog,
  }
}

const TRUST_THEMES = ['classic-warm', 'modern-office', 'functional-utility', 'minimalist-zen'] as const
const EMERGENCY_LAYOUTS = ['minimalist-lead', 'conversion-focus', 'compact-quote'] as const
const SERVICE_LAYOUTS = ['trust-builder', 'conversion-focus', 'local-expert'] as const

export const PLUMBING_SERVICES: ServiceDef[] = [
  plumb(
    'Drain Cleaning',
    'Drains',
    [...TRUST_THEMES],
    [...EMERGENCY_LAYOUTS, 'trust-builder'],
    { image: DRAIN_IMG, description: 'Fast drain clearing for sinks, tubs, and main lines.' },
    ['clog', 'drain snake', 'sewer line', 'backed up']
  ),
  plumb(
    'Water Heater Repair & Install',
    'Water heaters',
    ['modern-office', 'classic-warm', 'functional-utility', 'minimalist-zen'],
    [...SERVICE_LAYOUTS, 'compact-quote'],
    { image: WATER_HEATER_IMG, description: 'Tank and tankless water heater service you can count on.' },
    ['tankless', 'hot water', 'water heater replacement', 'water heater install', 'water heater repair']
  ),
  plumb(
    'Leak Detection & Repair',
    'Repairs',
    ['classic-warm', 'modern-office', 'minimalist-zen', 'functional-utility'],
    [...EMERGENCY_LAYOUTS, 'trust-builder'],
    { image: PIPE_IMG, description: 'Pinpoint leaks and lasting repairs before damage spreads.' },
    ['slab leak', 'pipe leak', 'water leak']
  ),
  plumb(
    'Fixture Install & Repair',
    'Fixtures',
    ['modern-office', 'classic-warm', 'luxury-minimal', 'functional-utility'],
    ['portfolio-first', 'conversion-focus', 'standard'],
    { image: BATH_IMG, description: 'Faucets, toilets, and fixtures installed right the first time.' },
    ['faucet', 'toilet', 'sink install', 'shower valve']
  ),
  plumb(
    'Sewer Line Service',
    'Drains',
    ['classic-warm', 'brutalist', 'functional-utility', 'modern-office'],
    ['trust-builder', 'conversion-focus', 'local-expert'],
    { image: DRAIN_IMG, description: 'Sewer camera inspection, repair, and replacement.' },
    ['sewer', 'main line', 'trenchless', 'septic']
  ),
  plumb(
    'Repiping & Pipe Replacement',
    'Repipes',
    ['classic-warm', 'modern-office', 'historic-classic', 'functional-utility'],
    ['trust-builder', 'storyteller', 'conversion-focus'],
    { image: PIPE_IMG, description: 'Whole-home repipes and pipe upgrades for older homes.' },
    ['repipe', 'copper pipe', 'pex', 'galvanized']
  ),
  plumb(
    'Bathroom Remodel Plumbing',
    'Remodel',
    ['luxury-minimal', 'classic-warm', 'elegant-dressing', 'modern-office'],
    ['portfolio-first', 'gallery-showcase', 'conversion-focus'],
    { image: BATH_IMG, description: 'Rough-in and finish plumbing for bathroom renovations.' },
    ['bathroom remodel', 'shower install', 'tub']
  ),
  plumb(
    'Kitchen Plumbing',
    'Remodel',
    ['modern-office', 'classic-warm', 'luxury-minimal', 'pantry-fresh'],
    ['portfolio-first', 'standard', 'conversion-focus'],
    { image: PLUMBING_IMG, description: 'Sink, dishwasher, and ice line plumbing for kitchens.' },
    ['kitchen sink', 'dishwasher hookup', 'garbage disposal']
  ),
  plumb(
    'Gas Line Install & Repair',
    'Gas',
    ['classic-warm', 'brutalist', 'functional-utility', 'modern-office'],
    ['trust-builder', 'conversion-focus', 'local-expert'],
    { image: PIPE_IMG, description: 'Licensed gas line work for ranges, dryers, and fireplaces.' },
    ['gas line', 'gas leak', 'gas stove']
  ),
  plumb(
    'Emergency Plumbing',
    'Emergency',
    ['classic-warm', 'brutalist', 'functional-utility', 'modern-office'],
    [...EMERGENCY_LAYOUTS],
    { image: PLUMBING_IMG, description: '24/7 emergency response when pipes fail.' },
    ['24/7', 'after hours', 'burst pipe', 'emergency plumber']
  ),
  plumb(
    'Water Filtration & Softeners',
    'Water quality',
    ['modern-office', 'classic-warm', 'minimalist-zen', 'functional-utility'],
    ['trust-builder', 'storyteller', 'conversion-focus'],
    { image: WATER_HEATER_IMG, description: 'Whole-home filtration and soft water solutions.' },
    ['water softener', 'reverse osmosis', 'water filter']
  ),
  plumb(
    'Commercial Plumbing',
    'Commercial',
    ['commercial-pro', 'modern-office', 'functional-utility', 'classic-warm'],
    ['trust-builder', 'conversion-focus', 'compact-quote'],
    { image: PLUMBING_IMG, description: 'Reliable plumbing for restaurants, offices, and retail.' },
    ['restaurant', 'commercial plumber', 'grease trap']
  ),
]

export const PLUMBING_GROUPS = [
  'Drains',
  'Water heaters',
  'Repairs',
  'Fixtures',
  'Repipes',
  'Remodel',
  'Gas',
  'Emergency',
  'Water quality',
  'Commercial',
] as const

export const PLUMBING_INDUSTRY: IndustryDef = {
  slug: 'plumbing',
  label: 'Plumbing',
  keywords: ['plumb', 'plumber', 'pipe', 'drain', 'water heater'],
  serviceGroups: [...PLUMBING_GROUPS],
  defaultThemes: ['modern-office', 'classic-warm', 'functional-utility', 'minimalist-zen'],
  defaultLayouts: ['trust-builder', 'conversion-focus', 'local-expert', 'minimalist-lead'],
  services: PLUMBING_SERVICES,
}
