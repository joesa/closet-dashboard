import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const APPLIANCE_IMG = 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13'
const WASHER_IMG = 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1'

function app(
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
    industry: 'appliance-repair',
    keywords,
    widgetCategory: label,
    recommendedThemes: themes,
    recommendedLayouts: layouts,
    catalog,
  }
}

const APP_THEMES = ['appliance-pro', 'functional-utility', 'modern-office', 'classic-warm'] as const
const APP_LAYOUTS = ['emergency-first', 'compact-quote', 'trust-builder', 'conversion-focus'] as const

export const APPLIANCE_REPAIR_SERVICES: ServiceDef[] = [
  app(
    'Washer & Dryer Repair',
    'Laundry',
    [...APP_THEMES],
    [...APP_LAYOUTS],
    { image: WASHER_IMG, description: 'Same-day washer and dryer repair for all major brands.' },
    ['washer repair', 'dryer repair', 'washing machine', 'laundry repair', 'spin cycle']
  ),
  app(
    'Refrigerator Repair',
    'Kitchen',
    ['appliance-pro', 'modern-office', 'functional-utility', 'minimalist-zen'],
    ['emergency-first', 'compact-quote', 'trust-builder', 'conversion-focus'],
    { image: APPLIANCE_IMG, description: 'Refrigerator and freezer repairs before your food spoils.' },
    ['fridge repair', 'refrigerator fix', 'freezer repair', 'ice maker', 'compressor']
  ),
  app(
    'Dishwasher Repair',
    'Kitchen',
    [...APP_THEMES],
    [...APP_LAYOUTS],
    { image: APPLIANCE_IMG, description: 'Leaking, not draining, or not cleaning? Fixed fast.' },
    ['dishwasher fix', 'dishwasher leak', 'dishwasher not draining']
  ),
  app(
    'Oven & Range Repair',
    'Kitchen',
    ['appliance-pro', 'classic-warm', 'functional-utility', 'modern-office'],
    ['compact-quote', 'trust-builder', 'conversion-focus', 'emergency-first'],
    { image: APPLIANCE_IMG, description: 'Gas and electric stove, oven, and range repair by certified techs.' },
    ['oven repair', 'stove repair', 'range repair', 'burner fix', 'gas oven']
  ),
  app(
    'Microwave Repair',
    'Kitchen',
    [...APP_THEMES],
    ['compact-quote', 'trust-builder', 'conversion-focus'],
    { image: APPLIANCE_IMG, description: 'Over-the-range and countertop microwave repairs.' },
    ['microwave fix', 'microwave not heating', 'microwave repair']
  ),
  app(
    'HVAC Appliance Service',
    'Climate',
    ['appliance-pro', 'functional-utility', 'commercial-pro', 'modern-office'],
    ['emergency-first', 'compact-quote', 'trust-builder'],
    { image: APPLIANCE_IMG, description: 'Window ACs, portable units, and dehumidifier repair and tune-ups.' },
    ['window ac repair', 'portable ac', 'dehumidifier repair', 'room ac']
  ),
  app(
    'Small Appliance Repair',
    'Small Appliances',
    ['appliance-pro', 'warm-handyman', 'functional-utility', 'classic-warm'],
    ['compact-quote', 'trust-builder', 'conversion-focus', 'standard'],
    { image: APPLIANCE_IMG, description: 'Vacuums, coffee makers, mixers, and more repaired or diagnosed.' },
    ['vacuum repair', 'coffee maker fix', 'small appliance', 'blender repair']
  ),
]

export const APPLIANCE_REPAIR_INDUSTRY: IndustryDef = {
  slug: 'appliance-repair',
  label: 'Appliance Repair',
  keywords: ['appliance repair', 'appliance fix', 'refrigerator repair', 'washer repair', 'dryer repair', 'appliance tech'],
  serviceGroups: ['Kitchen', 'Laundry', 'Climate', 'Small Appliances'],
  defaultThemes: ['appliance-pro', 'functional-utility', 'modern-office', 'classic-warm'],
  defaultLayouts: ['emergency-first', 'compact-quote', 'trust-builder', 'conversion-focus'],
  services: APPLIANCE_REPAIR_SERVICES,
}
