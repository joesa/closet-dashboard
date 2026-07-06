import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13'

function wp(label: string, group: string, industry: 'waterproofing' | 'foundation-repair', themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry, keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const WT = ['stone-masonry', 'functional-utility', 'commercial-pro', 'classic-warm'] as const
const WL = ['trust-builder', 'process-steps', 'before-after', 'trust-report'] as const

export const WATERPROOFING_SERVICES: ServiceDef[] = [
  wp('Interior Basement Waterproofing', 'Basement', 'waterproofing', [...WT], [...WL, 'conversion-focus'], { image: IMG, description: 'Interior drainage systems and sump pumps to keep basements dry.' }, ['basement waterproofing', 'wet basement', 'basement water', 'interior drain']),
  wp('Exterior Basement Waterproofing', 'Basement', 'waterproofing', [...WT], [...WL], { image: IMG, description: 'Excavation, membrane coating, and drainage board to stop water at the source.' }, ['exterior waterproofing', 'basement excavation', 'membrane waterproof']),
  wp('Crawl Space Encapsulation', 'Crawl Space', 'waterproofing', ['stone-masonry', 'fresh-clean', 'functional-utility', 'classic-warm'], ['before-after', 'trust-builder', 'process-steps', 'conversion-focus'], { image: IMG, description: 'Vapor barrier, insulation, and dehumidifier for a clean, dry crawl space.' }, ['crawl space encapsulation', 'vapor barrier', 'crawl space moisture', 'crawl space clean']),
  wp('Sump Pump Install & Repair', 'Sump Pump', 'waterproofing', ['functional-utility', 'classic-warm', 'modern-office', 'swift-mobile'], ['emergency-first', 'compact-quote', 'trust-builder', 'conversion-focus'], { image: IMG, description: 'Primary and battery backup sump pumps installed, maintained, and repaired.' }, ['sump pump', 'sump pump install', 'battery backup sump', 'sump pump repair']),
  wp('Window Well & Drain', 'Drainage', 'waterproofing', [...WT], ['compact-quote', 'trust-builder', 'local-expert', 'conversion-focus'], { image: IMG, description: 'Window well drains and covers to prevent basement window flooding.' }, ['window well drain', 'egress window', 'window well cover']),
]

export const FOUNDATION_REPAIR_SERVICES: ServiceDef[] = [
  wp('Foundation Crack Repair', 'Cracks', 'foundation-repair', [...WT], ['trust-report', 'before-after', 'trust-builder', 'conversion-focus'], { image: IMG, description: 'Epoxy and polyurethane injection to permanently seal foundation cracks.' }, ['foundation crack', 'crack injection', 'concrete crack foundation', 'basement wall crack']),
  wp('Pier & Beam Foundation Repair', 'Settlement', 'foundation-repair', ['stone-masonry', 'functional-utility', 'brutalist', 'commercial-pro'], ['trust-report', 'process-steps', 'trust-builder', 'conversion-focus'], { image: IMG, description: 'Push piers and helical piers to stabilize and lift a settling foundation.' }, ['foundation settling', 'pier repair', 'foundation piers', 'helical pier', 'sinking foundation']),
  wp('Wall Anchors & Carbon Fiber', 'Walls', 'foundation-repair', [...WT], ['process-steps', 'trust-report', 'trust-builder', 'conversion-focus'], { image: IMG, description: 'Carbon fiber straps and wall anchors to stabilize bowing basement walls.' }, ['bowing wall', 'wall anchor', 'carbon fiber wall', 'basement wall repair']),
  wp('Foundation Leveling', 'Settlement', 'foundation-repair', ['stone-masonry', 'functional-utility', 'commercial-pro', 'classic-warm'], ['trust-report', 'process-steps', 'trust-builder', 'compact-quote'], { image: IMG, description: 'Mudjacking and foam leveling for sunken slabs, porches, and driveways.' }, ['mudjacking', 'slab leveling', 'concrete leveling', 'polyurethane leveling', 'foam leveling']),
]

export const WATERPROOFING_INDUSTRY: IndustryDef = {
  slug: 'waterproofing', label: 'Waterproofing',
  keywords: ['waterproofing', 'basement waterproofing', 'wet basement', 'crawl space', 'sump pump', 'water intrusion'],
  serviceGroups: ['Basement', 'Crawl Space', 'Sump Pump', 'Drainage'],
  defaultThemes: ['stone-masonry', 'functional-utility', 'commercial-pro', 'classic-warm'],
  defaultLayouts: ['trust-builder', 'process-steps', 'before-after', 'trust-report'],
  services: WATERPROOFING_SERVICES,
}

export const FOUNDATION_REPAIR_INDUSTRY: IndustryDef = {
  slug: 'foundation-repair', label: 'Foundation Repair',
  keywords: ['foundation repair', 'foundation crack', 'settling foundation', 'bowing wall', 'pier foundation', 'foundation leveling'],
  serviceGroups: ['Cracks', 'Settlement', 'Walls'],
  defaultThemes: ['stone-masonry', 'functional-utility', 'brutalist', 'commercial-pro'],
  defaultLayouts: ['trust-report', 'process-steps', 'trust-builder', 'before-after'],
  services: FOUNDATION_REPAIR_SERVICES,
}
