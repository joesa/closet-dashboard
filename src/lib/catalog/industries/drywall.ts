import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1558618047-f4cf4f1d82af'

function dw(label: string, group: string, themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry: 'drywall', keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['warm-handyman', 'functional-utility', 'bold-remodel', 'classic-warm'] as const
const L = ['before-after', 'trust-builder', 'process-steps', 'conversion-focus'] as const

export const DRYWALL_SERVICES: ServiceDef[] = [
  dw('Drywall Installation', 'Installation', [...T], [...L, 'compact-quote'], { image: IMG, description: 'Full drywall hanging, framing, and finishing for new construction and additions.' }, ['drywall install', 'hang drywall', 'sheetrock install', 'new drywall']),
  dw('Drywall Repair', 'Repair', ['warm-handyman', 'classic-warm', 'functional-utility', 'historic-classic'], ['before-after', 'trust-builder', 'compact-quote', 'local-expert'], { image: IMG, description: 'Holes, cracks, water damage, and nail pops repaired to a perfect match.' }, ['drywall repair', 'drywall patch', 'hole repair', 'drywall crack']),
  dw('Drywall Taping & Finishing', 'Finishing', ['warm-handyman', 'artisan-wood', 'functional-utility', 'bold-remodel'], ['process-steps', 'trust-builder', 'before-after', 'conversion-focus'], { image: IMG, description: 'Level 5 taping, mudding, and finishing for a flawless paint-ready surface.' }, ['taping and mudding', 'drywall finishing', 'level 5 finish', 'skim coat']),
  dw('Ceiling Texture & Repair', 'Texture', ['warm-handyman', 'classic-warm', 'functional-utility', 'historic-classic'], ['before-after', 'gallery-showcase', 'trust-builder', 'conversion-focus'], { image: IMG, description: 'Popcorn removal, knockdown, orange peel, and smooth ceiling finishing.' }, ['popcorn ceiling', 'ceiling texture', 'knockdown texture', 'orange peel', 'smooth ceiling']),
  dw('Water Damage Drywall Repair', 'Repair', ['warm-handyman', 'fresh-clean', 'functional-utility', 'classic-warm'], ['emergency-first', 'before-after', 'trust-builder', 'conversion-focus'], { image: IMG, description: 'Mold-resistant drywall replacement after leaks, floods, or pipe bursts.' }, ['water damaged drywall', 'wet drywall', 'mold drywall', 'flood damage drywall']),
  dw('Commercial Drywall', 'Commercial', ['commercial-pro', 'functional-utility', 'modern-office', 'brutalist'], ['trust-builder', 'compact-quote', 'conversion-focus', 'process-steps'], { image: IMG, description: 'Metal stud framing and drywall for commercial offices and tenant improvements.' }, ['commercial drywall', 'office drywall', 'metal stud framing', 'tenant improvement drywall']),
  dw('Soundproof Drywall', 'Specialty', ['modern-office', 'media-theater', 'functional-utility', 'warm-handyman'], ['trust-builder', 'compact-quote', 'standard', 'conversion-focus'], { image: IMG, description: 'Double-layer and decoupled drywall assemblies for acoustic separation.' }, ['soundproof drywall', 'acoustic drywall', 'resilient channel', 'quiet glue']),
]

export const DRYWALL_INDUSTRY: IndustryDef = {
  slug: 'drywall', label: 'Drywall Services',
  keywords: ['drywall', 'sheetrock', 'drywall repair', 'drywall installation', 'taping and mudding', 'popcorn ceiling'],
  serviceGroups: ['Installation', 'Repair', 'Finishing', 'Texture', 'Commercial', 'Specialty'],
  defaultThemes: ['warm-handyman', 'functional-utility', 'bold-remodel', 'classic-warm'],
  defaultLayouts: ['before-after', 'trust-builder', 'process-steps', 'conversion-focus'],
  services: DRYWALL_SERVICES,
}
