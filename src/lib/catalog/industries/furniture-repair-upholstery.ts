import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32'

function svc(label: string, group: string, themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry: 'furniture-repair-upholstery', keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['artisan-wood', 'classic-warm', 'creative-craft', 'historic-classic'] as const
const L = ['before-after', 'gallery-showcase', 'portfolio-first', 'trust-builder'] as const

export const FURNITURE_REPAIR_SERVICES: ServiceDef[] = [
  svc('Furniture Reupholstery', 'Upholstery', [...T], [...L], { image: IMG, description: 'Sofas and chairs stripped to the frame and rebuilt in your fabric.' }, ['reupholstery', 'reupholster couch', 'furniture upholstery', 'upholstering', 'upholsterer']),
  svc('Furniture Repair', 'Repair', [...T], [...L], { image: IMG, description: 'Loose joints, broken legs, and split panels repaired and reglued.' }, ['furniture repair', 'couch repair', 'chair repair', 'table repair', 'broken furniture']),
  svc('Wood Furniture Refinishing', 'Refinishing', [...T], [...L], { image: IMG, description: 'Stripping, staining, and re-sealing wood pieces back to a usable finish.' }, ['furniture refinishing', 'furniture refinisher', 'wood refinishing', 'strip and refinish']),
  svc('Antique Restoration', 'Antiques', [...T], [...L], { image: IMG, description: 'Period-appropriate repair that keeps the value in the piece.' }, ['antique restoration', 'antique repair', 'antique furniture restoration', 'restore antique']),
  svc('Leather Furniture Repair', 'Leather', [...T], [...L], { image: IMG, description: 'Tears, worn arms, and colour loss repaired in leather and vinyl.' }, ['leather furniture repair', 'leather repair', 'vinyl repair', 'leather recolouring']),
  svc('Recliner & Mechanism Repair', 'Repair', [...T], [...L], { image: IMG, description: 'Recliner mechanisms, motors, and springs replaced.' }, ['recliner repair', 'recliner mechanism', 'power recliner repair', 'sofa mechanism']),
  svc('Cane, Rush & Wicker Repair', 'Antiques', [...T], [...L], { image: IMG, description: 'Hand caning, rush seats, and wicker rebuilt strand by strand.' }, ['wicker repair', 'cane repair', 'caning', 'rush seat repair', 'rattan repair']),
  svc('Lamp Repair & Rewiring', 'Repair', [...T], [...L], { image: IMG, description: 'Lamps rewired, sockets replaced, and antique fixtures made safe.' }, ['lamp repair', 'antique lamp repair', 'rewire lamp', 'lamp rewiring']),
]

export const FURNITURE_REPAIR_INDUSTRY: IndustryDef = {
  slug: 'furniture-repair-upholstery', label: 'Furniture Repair & Upholstery',
  keywords: ['upholstery', 'upholsterer', 'furniture repair', 'furniture refinishing', 'reupholster', 'antique restoration', 'leather repair', 'wicker repair', 'caning'],
  serviceGroups: ['Upholstery', 'Repair', 'Refinishing', 'Antiques', 'Leather'],
  defaultThemes: [...T],
  defaultLayouts: [...L],
  services: FURNITURE_REPAIR_SERVICES,
}
