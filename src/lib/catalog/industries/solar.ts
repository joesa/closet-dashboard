import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const SOLAR_IMG = 'https://images.unsplash.com/photo-1509391366360-2e959784a276'
const PANEL_IMG = 'https://images.unsplash.com/photo-1558449028-b53a39d100fc'
const BATTERY_IMG = 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13'

function sol(
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
    industry: 'solar',
    keywords,
    widgetCategory: label,
    recommendedThemes: themes,
    recommendedLayouts: layouts,
    catalog,
  }
}

const SOL_THEMES = ['eco-solar', 'modern-office', 'minimalist-zen', 'coastal-climate'] as const
const SOL_LAYOUTS = ['process-steps', 'trust-report', 'conversion-focus', 'storyteller'] as const

export const SOLAR_SERVICES: ServiceDef[] = [
  sol(
    'Solar Panel Installation',
    'Installation',
    [...SOL_THEMES],
    [...SOL_LAYOUTS, 'visual-impact'],
    { image: SOLAR_IMG, description: 'Residential and commercial solar panel systems designed, permitted, and installed.' },
    ['solar install', 'solar panels', 'pv install', 'photovoltaic', 'solar system installation']
  ),
  sol(
    'Battery Storage & Backup',
    'Storage',
    ['eco-solar', 'modern-office', 'sleek-entertainment', 'minimalist-zen'],
    ['process-steps', 'trust-report', 'conversion-focus', 'trust-builder'],
    { image: BATTERY_IMG, description: 'Tesla Powerwall, Enphase, and Franklin batteries installed for backup power.' },
    ['battery backup', 'powerwall', 'energy storage', 'solar battery', 'backup power']
  ),
  sol(
    'Solar Panel Cleaning',
    'Maintenance',
    ['eco-solar', 'fresh-clean', 'coastal-climate', 'minimalist-zen'],
    ['seasonal-cta', 'compact-quote', 'local-expert', 'trust-builder'],
    { image: PANEL_IMG, description: 'Soft-wash panel cleaning to restore output and extend panel life.' },
    ['solar cleaning', 'panel cleaning', 'solar panel wash', 'clean solar panels']
  ),
  sol(
    'Solar System Monitoring & Repair',
    'Maintenance',
    ['eco-solar', 'modern-office', 'functional-utility', 'commercial-pro'],
    ['trust-report', 'trust-builder', 'compact-quote', 'conversion-focus'],
    { image: SOLAR_IMG, description: 'Inverter diagnosis, microinverter replacement, and output monitoring.' },
    ['solar repair', 'inverter repair', 'microinverter', 'solar troubleshoot', 'solar monitoring']
  ),
  sol(
    'Commercial Solar Installation',
    'Commercial',
    ['eco-solar', 'commercial-pro', 'modern-office', 'brutalist'],
    ['trust-report', 'conversion-focus', 'storyteller', 'trust-builder'],
    { image: SOLAR_IMG, description: 'Rooftop and ground-mount commercial solar for warehouses, offices, and farms.' },
    ['commercial solar', 'business solar', 'flat roof solar', 'ground mount solar', 'solar farm']
  ),
  sol(
    'EV Charger Installation',
    'EV',
    ['eco-solar', 'modern-office', 'sleek-entertainment', 'swift-mobile'],
    ['compact-quote', 'process-steps', 'trust-builder', 'conversion-focus'],
    { image: BATTERY_IMG, description: 'Level 2 home and commercial EV charger installation and permitting.' },
    ['ev charger', 'electric car charger', 'level 2 charger', 'tesla charger', 'ev install', 'chargepoint']
  ),
  sol(
    'Solar Permitting & Interconnection',
    'Compliance',
    ['eco-solar', 'commercial-pro', 'modern-office', 'functional-utility'],
    ['trust-report', 'process-steps', 'trust-builder', 'conversion-focus'],
    { image: SOLAR_IMG, description: 'Full permit filing and utility interconnection handled so you don\'t have to.' },
    ['solar permit', 'interconnection', 'net metering', 'utility approval', 'pto']
  ),
]

export const SOLAR_INDUSTRY: IndustryDef = {
  slug: 'solar',
  label: 'Solar & Clean Energy',
  keywords: ['solar', 'solar panels', 'solar energy', 'solar install', 'photovoltaic', 'ev charger', 'battery backup'],
  serviceGroups: ['Installation', 'Storage', 'Maintenance', 'Commercial', 'EV', 'Compliance'],
  defaultThemes: ['eco-solar', 'modern-office', 'minimalist-zen', 'coastal-climate'],
  defaultLayouts: ['process-steps', 'trust-report', 'conversion-focus', 'storyteller'],
  services: SOLAR_SERVICES,
}
