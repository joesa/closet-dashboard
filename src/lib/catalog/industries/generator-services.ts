import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13'

function gen(label: string, group: string, themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry: 'generator-services', keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['functional-utility', 'modern-office', 'commercial-pro', 'swift-mobile'] as const
const L = ['emergency-first', 'trust-builder', 'compact-quote', 'process-steps'] as const

export const GENERATOR_SERVICES_SERVICES: ServiceDef[] = [
  gen('Standby Generator Installation', 'Installation', ['modern-office', 'functional-utility', 'commercial-pro', 'classic-warm'], ['process-steps', 'trust-builder', 'conversion-focus', 'compact-quote'], { image: IMG, description: 'Whole-home and commercial standby generators installed, permitted, and connected.' }, ['standby generator', 'whole home generator', 'generator install', 'generac install', 'kohler generator']),
  gen('Generator Repair', 'Repair', [...T], [...L, 'conversion-focus'], { image: IMG, description: 'Diagnostic and repair service for all major generator brands.' }, ['generator repair', 'generator fix', 'generator not starting', 'generator service']),
  gen('Generator Maintenance & Tune-Up', 'Maintenance', [...T], ['trust-builder', 'compact-quote', 'seasonal-cta', 'local-expert'], { image: IMG, description: 'Annual maintenance, load bank testing, and oil/filter changes.' }, ['generator maintenance', 'generator tune up', 'annual generator service', 'generator check']),
  gen('Transfer Switch Installation', 'Installation', ['functional-utility', 'modern-office', 'commercial-pro', 'classic-warm'], ['process-steps', 'compact-quote', 'trust-builder', 'conversion-focus'], { image: IMG, description: 'Automatic transfer switches that switch to generator power within seconds.' }, ['transfer switch', 'automatic transfer switch', 'ats', 'manual transfer switch']),
  gen('Portable Generator Service', 'Portable', ['functional-utility', 'swift-mobile', 'classic-warm', 'warm-handyman'], ['compact-quote', 'trust-builder', 'conversion-focus', 'local-expert'], { image: IMG, description: 'Portable generator carburetor cleaning, tune-ups, and fuel system repair.' }, ['portable generator', 'portable generator repair', 'honda generator', 'gas generator']),
  gen('Commercial Generator Service', 'Commercial', ['commercial-pro', 'functional-utility', 'modern-office', 'brutalist'], ['trust-builder', 'compact-quote', 'trust-report', 'conversion-focus'], { image: IMG, description: 'Critical power solutions for hospitals, data centers, and industrial facilities.' }, ['commercial generator', 'industrial generator', 'data center generator', 'critical power']),
]

export const GENERATOR_SERVICES_INDUSTRY: IndustryDef = {
  slug: 'generator-services', label: 'Generator Services',
  keywords: ['generator', 'generator install', 'standby generator', 'generator repair', 'whole home generator', 'backup power'],
  serviceGroups: ['Installation', 'Repair', 'Maintenance', 'Portable', 'Commercial'],
  defaultThemes: ['functional-utility', 'modern-office', 'commercial-pro', 'swift-mobile'],
  defaultLayouts: ['emergency-first', 'trust-builder', 'compact-quote', 'process-steps'],
  services: GENERATOR_SERVICES_SERVICES,
}
