import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1503387762-592deb58ef4e'

function svc(label: string, group: string, themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry: 'general-contracting', keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['stone-masonry', 'commercial-pro', 'classic-warm', 'functional-utility'] as const
const L = ['process-steps', 'trust-builder', 'portfolio-first', 'conversion-focus'] as const

export const GENERAL_CONTRACTING_SERVICES: ServiceDef[] = [
  svc('Custom Home Building', 'New Builds', [...T], [...L], { image: IMG, description: 'Ground-up custom homes from foundation through final walkthrough.' }, ['custom home builder', 'home building', 'new construction home', 'custom builder', 'build a house']),
  svc('Home Additions', 'Additions', [...T], [...L], { image: IMG, description: 'Room additions, second stories, and in-law suites tied into the existing structure.' }, ['home addition', 'room addition', 'second story addition', 'house addition', 'bump out']),
  svc('Whole-House Remodeling', 'Remodels', [...T], [...L], { image: IMG, description: 'Gut remodels where the layout, systems, and finishes all change.' }, ['whole house remodel', 'home remodeling contractor', 'gut remodel', 'full renovation']),
  svc('Basement Finishing', 'Remodels', [...T], [...L], { image: IMG, description: 'Unfinished basements framed, insulated, wired, and finished to code.' }, ['basement finishing', 'finish basement', 'basement remodel', 'basement companies']),
  svc('Garage Building & Conversion', 'Additions', [...T], [...L], { image: IMG, description: 'Detached garages built, and attached garages converted to living space.' }, ['garage builder', 'garage construction', 'garage conversion', 'garage remodeling']),
  svc('House Leveling & Structural Repair', 'Structural', [...T], [...L], { image: IMG, description: 'Settled homes lifted and re-supported, with beam and joist replacement.' }, ['house leveling', 'structural repair', 'house lifting', 'sill replacement']),
  svc('Modular & Manufactured Home Setup', 'New Builds', [...T], [...L], { image: IMG, description: 'Modular and manufactured homes set, tied down, and connected.' }, ['modular home', 'manufactured home setup', 'mobile home remodeling', 'modular construction']),
  svc('Construction Management', 'Management', [...T], [...L], { image: IMG, description: 'Permits, trades, and schedule run for owners acting as their own developer.' }, ['construction management', 'project management construction', 'owner builder support', 'permit management']),
]

export const GENERAL_CONTRACTING_INDUSTRY: IndustryDef = {
  slug: 'general-contracting', label: 'General Contracting',
  keywords: ['general contractor', 'general contracting', 'builder', 'builders', 'building contractor', 'custom builder', 'home builder', 'construction company', 'remodeling contractor', 'subcontractor', 'modular home', 'house leveling', 'mobile home remodel', 'manufactured home remodel', 'basement remodel', 'remodeling basement', 'mobile home', 'modular'],
  serviceGroups: ['New Builds', 'Additions', 'Remodels', 'Structural', 'Management'],
  defaultThemes: [...T],
  defaultLayouts: [...L],
  services: GENERAL_CONTRACTING_SERVICES,
}
