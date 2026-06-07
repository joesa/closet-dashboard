import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const HVAC_IMG = 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4'
const AC_IMG = 'https://images.unsplash.com/photo-1631545806606-09970edda2a5'
const FURNACE_IMG = 'https://images.unsplash.com/photo-1581094794329-c8112a89af12'
const DUCT_IMG = 'https://images.unsplash.com/photo-1504307651254-35680f356dfd'

function hvac(
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
    industry: 'hvac',
    keywords,
    widgetCategory: label,
    recommendedThemes: themes,
    recommendedLayouts: layouts,
    catalog,
  }
}

const PRO_THEMES = ['modern-office', 'commercial-pro', 'functional-utility', 'classic-warm'] as const
const EMERGENCY_LAYOUTS = ['minimalist-lead', 'conversion-focus', 'compact-quote'] as const

export const HVAC_SERVICES: ServiceDef[] = [
  hvac(
    'AC Repair & Service',
    'Cooling',
    [...PRO_THEMES, 'coastal-climate'],
    [...EMERGENCY_LAYOUTS, 'trust-builder'],
    { image: AC_IMG, description: 'Fast AC diagnostics and repair when summer hits.' },
    ['air conditioning', 'ac not cooling', 'central air']
  ),
  hvac(
    'AC Installation & Replacement',
    'Cooling',
    ['modern-office', 'commercial-pro', 'sleek-entertainment', 'coastal-climate'],
    ['portfolio-first', 'conversion-focus', 'trust-builder'],
    { image: AC_IMG, description: 'High-efficiency AC installs sized for your home.' },
    ['new ac', 'ac replacement', 'mini split']
  ),
  hvac(
    'Furnace Repair & Service',
    'Heating',
    [...PRO_THEMES, 'classic-warm'],
    [...EMERGENCY_LAYOUTS, 'local-expert'],
    { image: FURNACE_IMG, description: 'Reliable furnace repair before cold weather arrives.' },
    ['furnace', 'furnace not working', 'no heat', 'heat pump']
  ),
  hvac(
    'Furnace Installation & Replacement',
    'Heating',
    ['classic-warm', 'modern-office', 'commercial-pro', 'functional-utility'],
    ['trust-builder', 'conversion-focus', 'storyteller'],
    { image: FURNACE_IMG, description: 'Energy-smart furnace and heat pump installations.' },
    ['new furnace', 'boiler', 'radiant heat']
  ),
  hvac(
    'Heat Pump Service',
    'Heating',
    ['modern-office', 'coastal-climate', 'functional-utility', 'minimalist-zen'],
    ['conversion-focus', 'trust-builder', 'standard'],
    { image: HVAC_IMG, description: 'Year-round comfort with heat pump tune-ups and installs.' },
    ['heat pump repair', 'ductless heat pump']
  ),
  hvac(
    'Duct Cleaning & Sealing',
    'Air quality',
    ['laundry-clean', 'modern-office', 'minimalist-zen', 'functional-utility'],
    ['trust-builder', 'storyteller', 'local-expert'],
    { image: DUCT_IMG, description: 'Cleaner air and better efficiency with duct service.' },
    ['air duct', 'ductwork', 'indoor air']
  ),
  hvac(
    'Indoor Air Quality',
    'Air quality',
    ['minimalist-zen', 'modern-office', 'laundry-clean', 'classic-warm'],
    ['trust-builder', 'storyteller', 'conversion-focus'],
    { image: HVAC_IMG, description: 'Purifiers, humidifiers, and IAQ upgrades.' },
    ['air purifier', 'humidifier', 'allergies', 'uv light']
  ),
  hvac(
    'Thermostat & Smart Home',
    'Controls',
    ['sleek-entertainment', 'modern-office', 'minimalist-zen', 'commercial-pro'],
    ['compact-quote', 'conversion-focus', 'standard'],
    { image: HVAC_IMG, description: 'Smart thermostat installs and zoning controls.' },
    ['nest', 'ecobee', 'zoning', 'smart thermostat']
  ),
  hvac(
    'Commercial HVAC',
    'Commercial',
    ['commercial-pro', 'modern-office', 'brutalist', 'functional-utility'],
    ['trust-builder', 'conversion-focus', 'compact-quote'],
    { image: HVAC_IMG, description: 'Rooftop units and commercial comfort systems.' },
    ['rtu', 'commercial ac', 'office hvac']
  ),
  hvac(
    'Emergency HVAC',
    'Emergency',
    ['brutalist', 'functional-utility', 'modern-office', 'classic-warm'],
    [...EMERGENCY_LAYOUTS],
    { image: HVAC_IMG, description: 'After-hours HVAC when systems fail.' },
    ['24/7 hvac', 'no heat', 'no ac', 'emergency']
  ),
  hvac(
    'Maintenance Plans',
    'Maintenance',
    ['modern-office', 'classic-warm', 'functional-utility', 'minimalist-zen'],
    ['trust-builder', 'local-expert', 'conversion-focus'],
    { image: HVAC_IMG, description: 'Seasonal tune-ups that extend equipment life.' },
    ['maintenance plan', 'tune up', 'service agreement']
  ),
]

export const HVAC_GROUPS = [
  'Cooling',
  'Heating',
  'Air quality',
  'Controls',
  'Commercial',
  'Emergency',
  'Maintenance',
] as const

export const HVAC_INDUSTRY: IndustryDef = {
  slug: 'hvac',
  label: 'HVAC',
  keywords: ['hvac', 'heating', 'cooling', 'air condition', 'furnace', 'ac repair'],
  serviceGroups: [...HVAC_GROUPS],
  defaultThemes: ['modern-office', 'commercial-pro', 'classic-warm', 'functional-utility'],
  defaultLayouts: ['trust-builder', 'conversion-focus', 'local-expert', 'minimalist-lead'],
  services: HVAC_SERVICES,
}