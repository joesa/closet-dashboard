import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13'

function ab(label: string, group: string, themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry: 'auto-body', keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['garage-industrial', 'bold-remodel', 'commercial-pro', 'functional-utility'] as const
const L = ['before-after', 'trust-builder', 'compact-quote', 'gallery-showcase'] as const

export const AUTO_BODY_SERVICES: ServiceDef[] = [
  ab('Collision Repair', 'Collision', [...T], [...L, 'conversion-focus'], { image: IMG, description: 'Full collision repair — frame straightening, panel replacement, and paint matching.' }, ['collision repair', 'auto body repair', 'fender repair', 'bumper repair', 'auto collision']),
  ab('Auto Painting', 'Paint', ['garage-industrial', 'bold-remodel', 'commercial-pro', 'brutalist'], ['before-after', 'gallery-showcase', 'visual-impact', 'conversion-focus'], { image: IMG, description: 'Spot and full respray in factory-matched or custom color for any make and model.' }, ['auto painting', 'car paint', 'car respray', 'auto repaint', 'custom paint']),
  ab('Paintless Dent Repair (PDR)', 'Dents', ['garage-industrial', 'bold-remodel', 'modern-office', 'functional-utility'], ['before-after', 'compact-quote', 'trust-builder', 'gallery-showcase'], { image: IMG, description: 'Hail damage and minor dent removal without painting — original finish preserved.' }, ['paintless dent repair', 'pdr', 'dent removal', 'hail damage repair', 'dent fix']),
  ab('Scratch & Chip Repair', 'Paint', ['garage-industrial', 'bold-remodel', 'warm-handyman', 'commercial-pro'], ['before-after', 'compact-quote', 'trust-builder', 'local-expert'], { image: IMG, description: 'Touch-up paint and clear coat repair for scratches, chips, and keying damage.' }, ['scratch repair', 'paint chip', 'car scratch fix', 'clear coat repair']),
  ab('Frame & Structural Repair', 'Structural', ['garage-industrial', 'commercial-pro', 'brutalist', 'functional-utility'], ['trust-report', 'before-after', 'trust-builder', 'process-steps'], { image: IMG, description: 'Computerized frame straightening and structural repair to factory specs.' }, ['frame repair', 'frame straightening', 'structural repair', 'auto frame']),
  ab('Bumper Repair & Replacement', 'Bumpers', [...T], [...L], { image: IMG, description: 'Plastic bumper repair, repaint, and full bumper replacement.' }, ['bumper repair', 'bumper replacement', 'bumper fix', 'rear bumper', 'front bumper']),
  ab('Glass & Windshield', 'Glass', ['garage-industrial', 'functional-utility', 'modern-office', 'commercial-pro'], ['compact-quote', 'emergency-first', 'trust-builder', 'local-expert'], { image: IMG, description: 'Windshield chip repair, crack replacement, and auto glass replacement.' }, ['windshield replacement', 'windshield chip repair', 'auto glass', 'car glass']),
]

export const AUTO_BODY_INDUSTRY: IndustryDef = {
  slug: 'auto-body', label: 'Auto Body & Collision Repair',
  keywords: ['auto body', 'collision repair', 'auto painting', 'auto paint', 'dent repair', 'pdr', 'hail damage', 'car body repair'],
  serviceGroups: ['Collision', 'Paint', 'Dents', 'Structural', 'Bumpers', 'Glass'],
  defaultThemes: ['garage-industrial', 'bold-remodel', 'commercial-pro', 'functional-utility'],
  defaultLayouts: ['before-after', 'trust-builder', 'compact-quote', 'gallery-showcase'],
  services: AUTO_BODY_SERVICES,
}
