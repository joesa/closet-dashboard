import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1581094794329-c8112a89af12'

function svc(label: string, group: string, themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry: 'water-damage-restoration', keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['home-guardian', 'swift-mobile', 'commercial-pro', 'functional-utility'] as const
const L = ['emergency-first', 'trust-report', 'before-after', 'trust-builder'] as const

export const WATER_DAMAGE_RESTORATION_SERVICES: ServiceDef[] = [
  svc('Emergency Water Extraction', 'Emergency', [...T], [...L], { image: IMG, description: 'Standing water pulled the same day, before it wicks up the walls.' }, ['water extraction', 'emergency water removal', 'flood cleanup', 'water clean up', 'water damage companies']),
  svc('Structural Drying & Dehumidification', 'Drying', [...T], [...L], { image: IMG, description: 'Air movers and dehumidifiers set and monitored to a documented dry standard.' }, ['structural drying', 'dehumidification', 'water damage drying', 'moisture control']),
  svc('Burst Pipe & Appliance Leak Cleanup', 'Emergency', [...T], [...L], { image: IMG, description: 'Supply-line and appliance failures cleaned up and dried out.' }, ['burst pipe cleanup', 'appliance leak', 'water leak cleanup', 'pipe break water damage']),
  svc('Basement Flood Cleanup', 'Emergency', [...T], [...L], { image: IMG, description: 'Flooded basements pumped, cleaned, and dried, with the cause traced.' }, ['basement flooding', 'basement leak repair', 'flooded basement', 'basement water cleanup']),
  svc('Sewage & Category 3 Cleanup', 'Sewage', [...T], [...L], { image: IMG, description: 'Contaminated water handled with containment and disinfection.' }, ['sewage cleanup', 'sewage backup', 'category 3 water', 'black water cleanup']),
  svc('Storm & Roof Leak Damage', 'Emergency', [...T], [...L], { image: IMG, description: 'Wind-driven rain and roof leak damage dried and repaired.' }, ['storm damage cleanup', 'roof leak damage', 'wind damage water', 'storm water damage']),
  svc('Moisture Inspection & Documentation', 'Drying', [...T], [...L], { image: IMG, description: 'Meter readings, photos, and reports your insurer will accept.' }, ['moisture inspection', 'water damage assessment', 'moisture mapping', 'damage documentation']),
  svc('Reconstruction After Water Damage', 'Repair', [...T], [...L], { image: IMG, description: 'Drywall, flooring, and trim rebuilt after the structure is dry.' }, ['water damage repair', 'restoration reconstruction', 'rebuild after flood', 'water damage restoration']),
]

export const WATER_DAMAGE_RESTORATION_INDUSTRY: IndustryDef = {
  slug: 'water-damage-restoration', label: 'Water Damage Restoration',
  keywords: ['water damage', 'flood cleanup', 'water extraction', 'water restoration', 'burst pipe cleanup', 'sewage cleanup', 'structural drying', 'storm damage cleanup'],
  serviceGroups: ['Emergency', 'Drying', 'Repair', 'Sewage'],
  defaultThemes: [...T],
  defaultLayouts: [...L],
  services: WATER_DAMAGE_RESTORATION_SERVICES,
}
