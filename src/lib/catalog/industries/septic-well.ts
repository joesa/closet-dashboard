import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13'

function mk(label: string, group: string, industry: 'septic-services' | 'well-services', themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry, keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['functional-utility', 'classic-warm', 'commercial-pro', 'modern-office'] as const
const L = ['trust-builder', 'compact-quote', 'local-expert', 'conversion-focus'] as const

export const SEPTIC_SERVICES_SERVICES: ServiceDef[] = [
  mk('Septic Tank Pumping', 'Pumping', 'septic-services', [...T], [...L, 'seasonal-cta'], { image: IMG, description: 'Regular and emergency septic tank pumping and waste hauling.' }, ['septic pumping', 'pump septic', 'septic tank pump', 'septic service']),
  mk('Septic Inspection', 'Inspection', 'septic-services', ['functional-utility', 'home-guardian', 'classic-warm', 'modern-office'], ['trust-report', 'trust-builder', 'local-expert', 'compact-quote'], { image: IMG, description: 'Full septic system inspection with camera and dye test for home sales.' }, ['septic inspection', 'septic system inspection', 'title v inspection', 'septic test']),
  mk('Septic Repair', 'Repair', 'septic-services', [...T], ['emergency-first', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Distribution box, baffle, and line repairs before full system replacement.' }, ['septic repair', 'septic line repair', 'distribution box', 'septic baffle']),
  mk('Drain Field Service', 'Drain Field', 'septic-services', ['functional-utility', 'commercial-pro', 'classic-warm', 'stone-masonry'], ['trust-report', 'process-steps', 'trust-builder', 'conversion-focus'], { image: IMG, description: 'Drain field aeration, restoration, and replacement services.' }, ['drain field', 'leach field', 'drain field repair', 'septic field restoration']),
  mk('Septic Installation', 'Installation', 'septic-services', ['functional-utility', 'commercial-pro', 'classic-warm', 'modern-office'], ['process-steps', 'trust-builder', 'compact-quote', 'trust-report'], { image: IMG, description: 'New septic system design, permitting, and installation for new construction.' }, ['septic install', 'new septic system', 'septic design', 'perc test']),
]

export const WELL_SERVICES_SERVICES: ServiceDef[] = [
  mk('Well Pump Repair & Replacement', 'Pump', 'well-services', [...T], [...L, 'emergency-first'], { image: IMG, description: 'Submersible and jet pump repair, replacement, and pressure tank service.' }, ['well pump repair', 'well pump replacement', 'no water', 'submersible pump', 'pressure tank']),
  mk('Water Well Drilling', 'Drilling', 'well-services', ['functional-utility', 'commercial-pro', 'classic-warm', 'stone-masonry'], ['process-steps', 'trust-builder', 'compact-quote', 'local-expert'], { image: IMG, description: 'Residential and agricultural water well drilling and casing installation.' }, ['well drilling', 'new water well', 'water well installation', 'drill well']),
  mk('Well Inspection & Testing', 'Inspection', 'well-services', ['functional-utility', 'home-guardian', 'classic-warm', 'modern-office'], ['trust-report', 'trust-builder', 'local-expert', 'compact-quote'], { image: IMG, description: 'Water quality testing, yield testing, and well inspection for home sales.' }, ['well inspection', 'well water test', 'water quality test', 'well yield test']),
  mk('Well Water Treatment', 'Treatment', 'well-services', ['functional-utility', 'fresh-clean', 'classic-warm', 'modern-office'], ['trust-report', 'process-steps', 'trust-builder', 'conversion-focus'], { image: IMG, description: 'Chlorination, iron filters, and UV disinfection for clean, safe well water.' }, ['well water treatment', 'iron filter well', 'chlorinate well', 'well water filter']),
]

export const SEPTIC_SERVICES_INDUSTRY: IndustryDef = {
  slug: 'septic-services', label: 'Septic Services',
  keywords: ['septic', 'septic pumping', 'septic inspection', 'septic repair', 'drain field', 'septic tank'],
  serviceGroups: ['Pumping', 'Inspection', 'Repair', 'Drain Field', 'Installation'],
  defaultThemes: ['functional-utility', 'classic-warm', 'commercial-pro', 'modern-office'],
  defaultLayouts: ['trust-builder', 'compact-quote', 'local-expert', 'conversion-focus'],
  services: SEPTIC_SERVICES_SERVICES,
}

export const WELL_SERVICES_INDUSTRY: IndustryDef = {
  slug: 'well-services', label: 'Water Well Services',
  keywords: ['well services', 'well pump', 'water well', 'well drilling', 'well repair', 'well inspection'],
  serviceGroups: ['Pump', 'Drilling', 'Inspection', 'Treatment'],
  defaultThemes: ['functional-utility', 'classic-warm', 'commercial-pro', 'modern-office'],
  defaultLayouts: ['trust-builder', 'compact-quote', 'local-expert', 'conversion-focus'],
  services: WELL_SERVICES_SERVICES,
}
