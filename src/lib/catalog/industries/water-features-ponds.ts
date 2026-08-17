import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13'

function svc(label: string, group: string, themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry: 'water-features-ponds', keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['luxury-minimal', 'minimalist-zen', 'wellness-calm', 'classic-warm'] as const
const L = ['gallery-showcase', 'portfolio-first', 'seasonal-cta', 'trust-builder'] as const

export const WATER_FEATURES_SERVICES: ServiceDef[] = [
  svc('Pond Construction', 'Ponds', [...T], [...L], { image: IMG, description: 'Lined and excavated ponds with proper shelving, liner, and edge.' }, ['pond builder', 'pond construction', 'pond installation', 'pond companies', 'water garden']),
  svc('Koi Pond Design & Build', 'Ponds', [...T], [...L], { image: IMG, description: 'Koi-depth ponds with the filtration and aeration koi actually need.' }, ['koi pond', 'koi pond builder', 'koi pond services', 'koi filtration']),
  svc('Waterfall & Stream Installation', 'Ponds', [...T], [...L], { image: IMG, description: 'Pondless waterfalls and streams built into existing grade.' }, ['waterfall installation', 'pondless waterfall', 'stream feature', 'rock waterfall']),
  svc('Fountain Installation', 'Fountains', [...T], [...L], { image: IMG, description: 'Basin, disappearing, and tiered fountains plumbed and set level.' }, ['fountain installation', 'fountains', 'garden fountain', 'water fountain install']),
  svc('Fountain & Pump Repair', 'Fountains', [...T], [...L], { image: IMG, description: 'Pumps, lines, and leaking basins repaired on existing features.' }, ['fountain repair', 'pump repair', 'water feature repair', 'leaking fountain']),
  svc('Pond Cleaning & Maintenance', 'Maintenance', [...T], [...L], { image: IMG, description: 'Spring cleanouts, filter service, and seasonal water treatment.' }, ['pond cleaning', 'pond maintenance', 'pond services', 'pond cleanout']),
  svc('Algae & Water Quality Treatment', 'Maintenance', [...T], [...L], { image: IMG, description: 'Algae control, aeration, and biological balance for a clear pond.' }, ['algae control', 'pond treatment', 'pond water quality', 'pond aeration']),
  svc('Aquarium Setup & Service', 'Aquariums', [...T], [...L], { image: IMG, description: 'Home and office aquariums installed and serviced on a schedule.' }, ['aquarium services', 'aquarium maintenance', 'fish tank service', 'aquarium setup']),
]

export const WATER_FEATURES_INDUSTRY: IndustryDef = {
  slug: 'water-features-ponds', label: 'Ponds & Water Features',
  keywords: ['pond', 'koi pond', 'water feature', 'fountain', 'waterfall', 'water garden', 'pondless waterfall', 'aquarium service'],
  serviceGroups: ['Ponds', 'Fountains', 'Maintenance', 'Aquariums'],
  defaultThemes: [...T],
  defaultLayouts: [...L],
  services: WATER_FEATURES_SERVICES,
}
