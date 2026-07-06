import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13'

function dc(label: string, group: string, industry: 'duct-cleaning' | 'tile-grout-cleaning', themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry, keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['fresh-clean', 'functional-utility', 'minimalist-zen', 'modern-office'] as const
const L = ['before-after', 'trust-builder', 'compact-quote', 'local-expert'] as const

export const DUCT_CLEANING_SERVICES: ServiceDef[] = [
  dc('Air Duct Cleaning', 'Ducts', 'duct-cleaning', [...T], [...L, 'conversion-focus'], { image: IMG, description: 'NADCA-standard duct cleaning to remove dust, allergens, and mold spores.' }, ['air duct cleaning', 'duct cleaning', 'hvac duct cleaning', 'vent cleaning']),
  dc('HVAC System Sanitization', 'Sanitization', 'duct-cleaning', ['fresh-clean', 'modern-office', 'functional-utility', 'home-guardian'], ['trust-report', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Antimicrobial fogging and UV treatment for ductwork and air handler systems.' }, ['duct sanitization', 'hvac sanitize', 'air purification', 'uv hvac']),
  dc('Dryer Vent Cleaning', 'Dryer Vents', 'duct-cleaning', ['fresh-clean', 'functional-utility', 'classic-warm', 'warm-handyman'], ['compact-quote', 'trust-builder', 'seasonal-cta', 'local-expert'], { image: IMG, description: 'Lint blockage removed from dryer vents to prevent fire hazards.' }, ['dryer vent cleaning', 'dryer vent', 'clean dryer vent', 'lint removal vent']),
  dc('Commercial Duct Cleaning', 'Commercial', 'duct-cleaning', ['commercial-pro', 'fresh-clean', 'functional-utility', 'modern-office'], ['trust-report', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'NADCA-certified commercial HVAC and restaurant exhaust duct cleaning.' }, ['commercial duct cleaning', 'restaurant exhaust cleaning', 'commercial hvac cleaning']),
]

export const TILE_GROUT_CLEANING_SERVICES: ServiceDef[] = [
  dc('Tile & Grout Cleaning', 'Cleaning', 'tile-grout-cleaning', [...T], [...L], { image: IMG, description: 'Steam cleaning and high-pressure extraction to restore grout to like-new.' }, ['tile cleaning', 'grout cleaning', 'tile and grout', 'dirty grout cleaning']),
  dc('Grout Sealing', 'Sealing', 'tile-grout-cleaning', ['fresh-clean', 'minimalist-zen', 'classic-warm', 'modern-office'], ['compact-quote', 'process-steps', 'trust-builder', 'conversion-focus'], { image: IMG, description: 'Penetrating grout sealer applied to protect against stains and moisture.' }, ['grout sealing', 'seal grout', 'grout protector', 'grout stain prevention']),
  dc('Grout Color Restoration', 'Restoration', 'tile-grout-cleaning', ['fresh-clean', 'bold-remodel', 'minimalist-zen', 'luxury-minimal'], ['before-after', 'gallery-showcase', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Grout colorant and epoxy regrouting to change or restore grout lines.' }, ['grout color', 'regrout', 'grout colorant', 'epoxy grout']),
  dc('Commercial Tile Maintenance', 'Commercial', 'tile-grout-cleaning', ['commercial-pro', 'fresh-clean', 'functional-utility', 'modern-office'], ['trust-builder', 'compact-quote', 'before-after', 'local-expert'], { image: IMG, description: 'VCT stripping and waxing, tile polishing, and grout maintenance for businesses.' }, ['commercial tile cleaning', 'vct floor', 'tile maintenance', 'floor stripping']),
]

export const DUCT_CLEANING_INDUSTRY: IndustryDef = {
  slug: 'duct-cleaning', label: 'Air Duct Cleaning',
  keywords: ['duct cleaning', 'air duct cleaning', 'hvac cleaning', 'vent cleaning', 'dryer vent cleaning'],
  serviceGroups: ['Ducts', 'Sanitization', 'Dryer Vents', 'Commercial'],
  defaultThemes: ['fresh-clean', 'functional-utility', 'minimalist-zen', 'modern-office'],
  defaultLayouts: ['before-after', 'trust-builder', 'compact-quote', 'local-expert'],
  services: DUCT_CLEANING_SERVICES,
}

export const TILE_GROUT_CLEANING_INDUSTRY: IndustryDef = {
  slug: 'tile-grout-cleaning', label: 'Tile & Grout Cleaning',
  keywords: ['tile', 'tile cleaning', 'grout cleaning', 'grout sealing', 'tile restoration', 'grout color', 'tile grout'],
  serviceGroups: ['Cleaning', 'Sealing', 'Restoration', 'Commercial'],
  defaultThemes: ['fresh-clean', 'functional-utility', 'minimalist-zen', 'modern-office'],
  defaultLayouts: ['before-after', 'trust-builder', 'compact-quote', 'local-expert'],
  services: TILE_GROUT_CLEANING_SERVICES,
}
