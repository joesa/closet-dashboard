import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13'

function ep(label: string, group: string, themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry: 'epoxy-flooring', keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['garage-industrial', 'bold-remodel', 'brutalist', 'commercial-pro'] as const
const L = ['before-after', 'gallery-showcase', 'visual-impact', 'conversion-focus'] as const

export const EPOXY_FLOORING_SERVICES: ServiceDef[] = [
  ep('Garage Floor Epoxy Coating', 'Garage', [...T], [...L, 'portfolio-first'], { image: IMG, description: 'Full-flake, solid, and metallic garage floor epoxy — durable and showroom-ready.' }, ['garage floor epoxy', 'epoxy garage', 'garage coating', 'floor epoxy', 'garage floor coating']),
  ep('Metallic Epoxy Flooring', 'Residential', ['bold-remodel', 'luxury-minimal', 'sleek-entertainment', 'minimalist-zen'], ['gallery-showcase', 'visual-impact', 'portfolio-first', 'storyteller'], { image: IMG, description: 'Swirling metallic pigment systems for one-of-a-kind residential floors.' }, ['metallic epoxy', 'metallic floor coating', 'pearlescent epoxy', '3d epoxy floor']),
  ep('Commercial Epoxy Flooring', 'Commercial', ['commercial-pro', 'functional-utility', 'brutalist', 'modern-office'], ['before-after', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'High-build, chemical-resistant epoxy for warehouses, kitchens, and labs.' }, ['commercial epoxy', 'warehouse epoxy', 'industrial epoxy', 'commercial floor coating']),
  ep('Polyurea / Polyaspartic Coating', 'Specialty', ['garage-industrial', 'functional-utility', 'commercial-pro', 'modern-office'], ['before-after', 'gallery-showcase', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Fast-cure polyurea coatings done in one day — harder and UV-stable.' }, ['polyurea coating', 'polyaspartic', 'one day floor', 'fast epoxy']),
  ep('Epoxy Floor Repair & Recoat', 'Repair', ['garage-industrial', 'warm-handyman', 'functional-utility', 'classic-warm'], ['before-after', 'compact-quote', 'trust-builder', 'local-expert'], { image: IMG, description: 'Peeling, chipped, and worn epoxy floors repaired and top-coated.' }, ['epoxy repair', 'floor recoat', 'peeling epoxy', 'garage floor repair']),
]

export const EPOXY_FLOORING_INDUSTRY: IndustryDef = {
  slug: 'epoxy-flooring', label: 'Epoxy Flooring',
  keywords: ['epoxy flooring', 'epoxy floor', 'garage floor epoxy', 'floor coating', 'concrete coating', 'polyurea'],
  serviceGroups: ['Garage', 'Residential', 'Commercial', 'Specialty', 'Repair'],
  defaultThemes: ['garage-industrial', 'bold-remodel', 'brutalist', 'commercial-pro'],
  defaultLayouts: ['before-after', 'gallery-showcase', 'visual-impact', 'conversion-focus'],
  services: EPOXY_FLOORING_SERVICES,
}
