import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1503387762-592deb58ef4e'

function svc(label: string, group: string, themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry: 'excavation-grading-materials', keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['fleet-logistics', 'functional-utility', 'stone-masonry', 'commercial-pro'] as const
const L = ['service-zones', 'trust-builder', 'compact-quote', 'process-steps'] as const

export const EXCAVATION_GRADING_SERVICES: ServiceDef[] = [
  svc('Site Excavation', 'Excavation', [...T], [...L], { image: IMG, description: 'Basements, footings, and utility trenches dug to plan.' }, ['excavation', 'excavating contractor', 'site excavation', 'digging services', 'trenching']),
  svc('Land Clearing & Brush Removal', 'Site Prep', [...T], [...L], { image: IMG, description: 'Trees, stumps, and brush cleared and hauled off the lot.' }, ['land clearing', 'brush removal', 'lot clearing', 'stump removal', 'forestry mulching']),
  svc('Grading & Drainage Correction', 'Grading', [...T], [...L], { image: IMG, description: 'Regrading that moves water away from the foundation instead of toward it.' }, ['grading', 'grading companies', 'yard grading', 'drainage grading', 'regrade yard']),
  svc('Driveway Grading & Gravel', 'Grading', [...T], [...L], { image: IMG, description: 'Gravel drives cut, crowned, and topped so they shed water.' }, ['driveway grading', 'gravel driveway', 'road grading', 'driveway repair gravel']),
  svc('Topsoil & Fill Dirt Delivery', 'Materials', [...T], [...L], { image: IMG, description: 'Screened topsoil and fill delivered and placed by the yard.' }, ['topsoil delivery', 'fill dirt', 'dirt hauling', 'soil delivery', 'dirt delivery']),
  svc('Gravel, Sand & Stone Delivery', 'Materials', [...T], [...L], { image: IMG, description: 'Crushed stone, sand, and decorative rock by the load.' }, ['gravel delivery', 'stone delivery', 'sand delivery', 'landscape rock delivery', 'stone and gravel']),
  svc('Pond & Basin Digging', 'Excavation', [...T], [...L], { image: IMG, description: 'Farm ponds, retention basins, and swales excavated and shaped.' }, ['pond digging', 'retention basin', 'farm pond excavation', 'swale digging']),
  svc('Demolition & Debris Hauling', 'Site Prep', [...T], [...L], { image: IMG, description: 'Structures taken down and the debris hauled to disposal.' }, ['demolition', 'structure demolition', 'debris hauling', 'concrete removal', 'grading and hauling']),
]

export const EXCAVATION_GRADING_INDUSTRY: IndustryDef = {
  slug: 'excavation-grading-materials', label: 'Excavation, Grading & Materials',
  keywords: ['excavation', 'grading', 'land clearing', 'dirt work', 'topsoil delivery', 'gravel delivery', 'site prep', 'trenching', 'bobcat work'],
  serviceGroups: ['Excavation', 'Grading', 'Materials', 'Site Prep'],
  defaultThemes: [...T],
  defaultLayouts: [...L],
  services: EXCAVATION_GRADING_SERVICES,
}
