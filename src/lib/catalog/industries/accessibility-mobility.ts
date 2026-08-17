import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1493809842364-78817add7ffb'

function svc(label: string, group: string, themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry: 'accessibility-mobility', keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['home-guardian', 'wellness-calm', 'functional-utility', 'classic-warm'] as const
const L = ['trust-builder', 'process-steps', 'conversion-focus', 'local-expert'] as const

export const ACCESSIBILITY_MOBILITY_SERVICES: ServiceDef[] = [
  svc('Wheelchair Ramp Installation', 'Ramps', [...T], [...L], { image: IMG, description: 'Permanent and modular ramps built to ADA slope and landing rules.' }, ['wheelchair ramp', 'ramp installation', 'handicap ramp', 'ada ramp', 'modular ramp']),
  svc('Stair Lift Installation', 'Lifts', [...T], [...L], { image: IMG, description: 'Straight and curved stair lifts fitted to the treads and serviced.' }, ['stair lift', 'stairlift installation', 'chair lift', 'chair lift companies']),
  svc('Vertical Platform Lift', 'Lifts', [...T], [...L], { image: IMG, description: 'Porch and platform lifts for entries a ramp cannot reach.' }, ['platform lift', 'vertical platform lift', 'porch lift', 'wheelchair lift']),
  svc('Accessible Bathroom Conversion', 'Bathroom', [...T], [...L], { image: IMG, description: 'Curbless showers, comfort-height fixtures, and turning clearance.' }, ['accessible bathroom', 'walk in shower conversion', 'handicap bathroom', 'roll in shower']),
  svc('Walk-In Tub Installation', 'Bathroom', [...T], [...L], { image: IMG, description: 'Walk-in tubs installed with the plumbing and framing changes they need.' }, ['walk in tub', 'walk in bathtub', 'accessible tub', 'safety tub']),
  svc('Grab Bar & Safety Rail Installation', 'Railings', [...T], [...L], { image: IMG, description: 'Grab bars anchored into wall blocking, so they hold a real fall.' }, ['grab bars', 'safety rails', 'bathroom grab bar', 'shower rail']),
  svc('Handrail & Stair Railing Installation', 'Railings', [...T], [...L], { image: IMG, description: 'Code-height handrails and guardrails for stairs and hallways.' }, ['handrail installers', 'stair railing', 'handrail installation', 'guardrail install']),
  svc('Stair Construction & Repair', 'Railings', [...T], [...L], { image: IMG, description: 'Interior and exterior stairs built, re-treaded, and brought to code.' }, ['stair builders', 'stair installers', 'stair repair', 'staircase construction']),
]

export const ACCESSIBILITY_MOBILITY_INDUSTRY: IndustryDef = {
  slug: 'accessibility-mobility', label: 'Accessibility & Mobility',
  keywords: ['wheelchair ramp', 'stair lift', 'chair lift', 'grab bars', 'accessible bathroom', 'aging in place', 'mobility modification', 'handrail installation', 'ada home'],
  serviceGroups: ['Ramps', 'Lifts', 'Bathroom', 'Railings'],
  defaultThemes: [...T],
  defaultLayouts: [...L],
  services: ACCESSIBILITY_MOBILITY_SERVICES,
}
