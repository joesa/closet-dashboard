import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b'

function svc(label: string, group: string, themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry: 'recreation-play-installs', keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['playful-kids', 'functional-utility', 'warm-handyman', 'classic-warm'] as const
const L = ['gallery-showcase', 'conversion-focus', 'process-steps', 'trust-builder'] as const

export const RECREATION_INSTALLS_SERVICES: ServiceDef[] = [
  svc('Playground & Play Set Installation', 'Play Sets', [...T], [...L], { image: IMG, description: 'Wooden and metal play sets assembled, anchored, and safety-checked.' }, ['playground installation', 'play set assembly', 'swing set installation', 'playgrounds']),
  svc('Playground Repair & Inspection', 'Maintenance', [...T], [...L], { image: IMG, description: 'Hardware, decks, and swings replaced on sets that have aged.' }, ['playground repair', 'play set repair', 'swing set repair', 'playground inspection']),
  svc('Basketball Hoop Installation', 'Courts', [...T], [...L], { image: IMG, description: 'In-ground and wall-mounted hoops set in concrete and squared.' }, ['basketball goal', 'basketball hoop installation', 'in ground hoop', 'goal installation']),
  svc('Trampoline Assembly & Anchoring', 'Assembly', [...T], [...L], { image: IMG, description: 'Trampolines assembled, netted, and anchored against wind.' }, ['trampoline assembly', 'trampoline installation', 'trampoline anchor']),
  svc('Sport Court & Tennis Court Construction', 'Courts', [...T], [...L], { image: IMG, description: 'Tennis, pickleball, and multi-sport courts surfaced and striped.' }, ['tennis court contractor', 'sport court', 'pickleball court', 'court resurfacing', 'basketball court']),
  svc('Batting Cage & Practice Nets', 'Courts', [...T], [...L], { image: IMG, description: 'Backyard cages and netting frames built and tensioned.' }, ['batting cage', 'practice net', 'golf net', 'sports netting']),
  svc('Grill & Outdoor Kitchen Assembly', 'Assembly', [...T], [...L], { image: IMG, description: 'Gas grills assembled, connected, and leak-tested.' }, ['grill assembly', 'gas grill installer', 'grill installation', 'outdoor kitchen assembly']),
  svc('Grill & Outdoor Equipment Repair', 'Maintenance', [...T], [...L], { image: IMG, description: 'Burners, igniters, and regulators replaced on gas grills.' }, ['gas grill repair', 'grill repair', 'bbq repair', 'burner replacement']),
]

export const RECREATION_INSTALLS_INDUSTRY: IndustryDef = {
  slug: 'recreation-play-installs', label: 'Play & Recreation Installation',
  keywords: ['playground installation', 'play set', 'swing set', 'basketball hoop', 'trampoline assembly', 'sport court', 'batting cage', 'game room install'],
  serviceGroups: ['Play Sets', 'Courts', 'Assembly', 'Maintenance'],
  defaultThemes: [...T],
  defaultLayouts: [...L],
  services: RECREATION_INSTALLS_SERVICES,
}
