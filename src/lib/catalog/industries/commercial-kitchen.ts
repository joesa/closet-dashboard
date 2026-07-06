import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13'

function cr(label: string, group: string, industry: 'commercial-refrigeration' | 'restaurant-equipment', themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry, keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['commercial-pro', 'functional-utility', 'modern-office', 'brutalist'] as const
const L = ['emergency-first', 'trust-builder', 'compact-quote', 'conversion-focus'] as const

export const COMMERCIAL_REFRIGERATION_SERVICES: ServiceDef[] = [
  cr('Walk-In Cooler & Freezer Repair', 'Walk-Ins', 'commercial-refrigeration', [...T], [...L], { image: IMG, description: 'Walk-in cooler and freezer emergency repair — we keep your product safe.' }, ['walk-in cooler repair', 'walk-in freezer repair', 'walk-in cooler service', 'commercial refrigeration']),
  cr('Commercial Refrigeration Installation', 'Installation', 'commercial-refrigeration', [...T], ['process-steps', 'trust-builder', 'compact-quote', 'trust-report'], { image: IMG, description: 'Reach-in cases, walk-ins, and refrigeration systems installed and commissioned.' }, ['commercial fridge install', 'refrigeration install', 'walk-in install', 'display case install']),
  cr('Ice Machine Service & Repair', 'Ice', 'commercial-refrigeration', [...T], [...L], { image: IMG, description: 'Manitowoc, Hoshizaki, and Scotsman ice machine repair, cleaning, and parts.' }, ['ice machine repair', 'ice machine service', 'commercial ice machine', 'ice maker repair']),
  cr('Refrigeration Preventive Maintenance', 'Maintenance', 'commercial-refrigeration', ['commercial-pro', 'functional-utility', 'modern-office', 'classic-warm'], ['trust-builder', 'compact-quote', 'trust-report', 'seasonal-cta'], { image: IMG, description: 'Scheduled PM programs to prevent costly breakdowns and extend equipment life.' }, ['refrigeration maintenance', 'pm program', 'preventive maintenance refrigeration']),
]

export const RESTAURANT_EQUIPMENT_SERVICES: ServiceDef[] = [
  cr('Commercial Oven & Range Repair', 'Kitchen', 'restaurant-equipment', [...T], [...L], { image: IMG, description: 'Gas and electric commercial oven, range, and convection oven repair.' }, ['commercial oven repair', 'restaurant oven', 'commercial range', 'convection oven repair']),
  cr('Commercial Fryer & Grill Service', 'Kitchen', 'restaurant-equipment', [...T], [...L], { image: IMG, description: 'Flat top grill cleaning, fryer filter service, and burner repair.' }, ['commercial fryer', 'flat top grill', 'fryer service', 'restaurant fryer']),
  cr('Commercial Dishwasher Service', 'Dishwashers', 'restaurant-equipment', [...T], [...L], { image: IMG, description: 'Hobart, Champion, and conveyor dishwasher repair and chemical service.' }, ['commercial dishwasher', 'restaurant dishwasher', 'dishwasher service', 'hobart repair']),
  cr('Kitchen Hood & Exhaust Cleaning', 'Exhaust', 'restaurant-equipment', ['commercial-pro', 'fresh-clean', 'functional-utility', 'modern-office'], ['trust-report', 'trust-builder', 'compact-quote', 'seasonal-cta'], { image: IMG, description: 'NFPA 96-compliant kitchen hood and exhaust system cleaning and inspection.' }, ['hood cleaning', 'kitchen exhaust cleaning', 'nfpa 96', 'restaurant hood']),
]

export const COMMERCIAL_REFRIGERATION_INDUSTRY: IndustryDef = {
  slug: 'commercial-refrigeration', label: 'Commercial Refrigeration',
  keywords: ['commercial refrigeration', 'walk-in cooler', 'walk-in freezer', 'ice machine', 'commercial fridge repair'],
  serviceGroups: ['Walk-Ins', 'Installation', 'Ice', 'Maintenance'],
  defaultThemes: ['commercial-pro', 'functional-utility', 'modern-office', 'brutalist'],
  defaultLayouts: ['emergency-first', 'trust-builder', 'compact-quote', 'conversion-focus'],
  services: COMMERCIAL_REFRIGERATION_SERVICES,
}

export const RESTAURANT_EQUIPMENT_INDUSTRY: IndustryDef = {
  slug: 'restaurant-equipment', label: 'Restaurant Equipment Repair',
  keywords: ['restaurant equipment', 'commercial kitchen repair', 'oven repair', 'fryer repair', 'commercial dishwasher', 'hood cleaning'],
  serviceGroups: ['Kitchen', 'Dishwashers', 'Exhaust'],
  defaultThemes: ['commercial-pro', 'functional-utility', 'modern-office', 'brutalist'],
  defaultLayouts: ['emergency-first', 'trust-builder', 'compact-quote', 'conversion-focus'],
  services: RESTAURANT_EQUIPMENT_SERVICES,
}
