import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1493809842364-78817add7ffb'

function svc(label: string, group: string, themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry: 'surface-refinishing', keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['fresh-clean', 'luxury-minimal', 'functional-utility', 'classic-warm'] as const
const L = ['before-after', 'gallery-showcase', 'conversion-focus', 'compact-quote'] as const

export const SURFACE_REFINISHING_SERVICES: ServiceDef[] = [
  svc('Bathtub Refinishing', 'Bath', [...T], [...L], { image: IMG, description: 'Chipped and stained tubs stripped, primed, and re-coated in place.' }, ['bathtub refinishing', 'tub reglazing', 'bathtub resurfacing', 'tub refinishing']),
  svc('Tile & Shower Reglazing', 'Bath', [...T], [...L], { image: IMG, description: 'Wall tile and shower pans re-coated instead of demolished.' }, ['tile reglazing', 'shower reglazing', 'tile refinishing', 'shower resurfacing']),
  svc('Sink Refinishing', 'Bath', [...T], [...L], { image: IMG, description: 'Cast iron and porcelain sinks re-coated to a factory-like finish.' }, ['sink refinishing', 'sink reglazing', 'porcelain repair', 'sink resurfacing']),
  svc('Countertop Resurfacing', 'Kitchen', [...T], [...L], { image: IMG, description: 'Existing counters re-coated in stone-look or solid finishes.' }, ['countertop resurfacing', 'countertop refinishing', 'counter resurfacing', 'laminate resurfacing']),
  svc('Cabinet Refacing', 'Kitchen', [...T], [...L], { image: IMG, description: 'New doors and veneer over sound cabinet boxes.' }, ['cabinet refacing', 'kitchen refacing', 'cabinet resurfacing', 'reface cabinets']),
  svc('Door Refinishing', 'Doors', [...T], [...L], { image: IMG, description: 'Entry and interior doors stripped, stained, and re-sealed.' }, ['door refinishing', 'door restoration', 'front door refinishing', 'stain door']),
  svc('Chip & Scratch Repair', 'Bath', [...T], [...L], { image: IMG, description: 'Spot repairs to tubs, counters, and appliances without a full re-coat.' }, ['chip repair', 'scratch repair', 'porcelain chip repair', 'surface repair']),
  svc('Commercial Tub & Surface Refinishing', 'Commercial', [...T], [...L], { image: IMG, description: 'Hotel and apartment unit turns done floor by floor on schedule.' }, ['commercial refinishing', 'hotel tub refinishing', 'apartment refinishing', 'multi unit refinishing']),
]

export const SURFACE_REFINISHING_INDUSTRY: IndustryDef = {
  slug: 'surface-refinishing', label: 'Surface Refinishing & Reglazing',
  keywords: ['refinishing', 'reglazing', 'resurfacing', 'bathtub refinishing', 'countertop resurfacing', 'tub reglazing', 'cabinet refacing', 'sink refinishing'],
  serviceGroups: ['Bath', 'Kitchen', 'Doors', 'Commercial'],
  defaultThemes: [...T],
  defaultLayouts: [...L],
  services: SURFACE_REFINISHING_SERVICES,
}
