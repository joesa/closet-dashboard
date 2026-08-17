import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64'

function svc(label: string, group: string, themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry: 'outdoor-structures', keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['artisan-wood', 'classic-warm', 'functional-utility', 'stone-masonry'] as const
const L = ['portfolio-first', 'gallery-showcase', 'process-steps', 'trust-builder'] as const

export const OUTDOOR_STRUCTURES_SERVICES: ServiceDef[] = [
  svc('Shed Building & Installation', 'Sheds', [...T], [...L], { image: IMG, description: 'Storage sheds and workshops built on site or delivered and set.' }, ['shed builder', 'storage shed', 'custom shed', 'shed installation', 'backyard shed']),
  svc('Gazebo & Pergola Construction', 'Shade', [...T], [...L], { image: IMG, description: 'Gazebos, pergolas, and pavilions built to match the house.' }, ['gazebo builder', 'pergola', 'pavilion', 'arbor', 'patio cover']),
  svc('Dock Building & Repair', 'Docks', [...T], [...L], { image: IMG, description: 'Boat docks, piers, and boat lifts built, re-decked, and re-piled.' }, ['dock builder', 'boat dock repair', 'pier construction', 'boat lift', 'seawall dock']),
  svc('Greenhouse Construction', 'Agricultural', [...T], [...L], { image: IMG, description: 'Hobby and production greenhouses erected, glazed, and vented.' }, ['greenhouse builder', 'greenhouse construction', 'hoop house', 'conservatory']),
  svc('Pole Barn & Metal Building', 'Agricultural', [...T], [...L], { image: IMG, description: 'Post-frame barns, shops, and equipment buildings from slab to trim.' }, ['pole barn', 'post frame building', 'metal building', 'equipment shed', 'barn builder']),
  svc('Carport & Awning Structures', 'Shade', [...T], [...L], { image: IMG, description: 'Freestanding carports and covered parking, engineered for wind load.' }, ['carport', 'carport repair', 'covered parking', 'metal carport']),
  svc('Storm Shelter Installation', 'Shelters', [...T], [...L], { image: IMG, description: 'Above and below ground storm shelters, anchored and rated.' }, ['storm shelter', 'tornado shelter', 'safe room', 'underground shelter']),
  svc('Playhouse & Treehouse Building', 'Sheds', [...T], [...L], { image: IMG, description: 'Custom playhouses and treehouses built to hold real weight.' }, ['playhouse builder', 'treehouse builder', 'kids playhouse', 'custom treehouse']),
]

export const OUTDOOR_STRUCTURES_INDUSTRY: IndustryDef = {
  slug: 'outdoor-structures', label: 'Outdoor Structures',
  keywords: ['shed builder', 'gazebo', 'pergola', 'dock builder', 'boat dock', 'carport', 'greenhouse', 'pole barn', 'outdoor structure', 'storm shelter', 'playhouse'],
  serviceGroups: ['Sheds', 'Shade', 'Docks', 'Agricultural', 'Shelters'],
  defaultThemes: [...T],
  defaultLayouts: [...L],
  services: OUTDOOR_STRUCTURES_SERVICES,
}
