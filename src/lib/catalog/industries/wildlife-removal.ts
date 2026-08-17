import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b'

function svc(label: string, group: string, themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry: 'wildlife-removal', keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['home-guardian', 'functional-utility', 'swift-mobile', 'classic-warm'] as const
const L = ['emergency-first', 'trust-builder', 'process-steps', 'local-expert'] as const

export const WILDLIFE_REMOVAL_SERVICES: ServiceDef[] = [
  svc('Raccoon & Opossum Removal', 'Removal', [...T], [...L], { image: IMG, description: 'Live trapping and removal, including mothers with young in an attic.' }, ['raccoon removal', 'opossum removal', 'possum control', 'raccoon in attic']),
  svc('Squirrel & Rodent Removal', 'Removal', [...T], [...L], { image: IMG, description: 'Squirrels, rats, and mice removed and their entry points closed.' }, ['squirrel removal', 'rodent removal', 'rat removal', 'mice in attic', 'groundhog removal']),
  svc('Bat Removal & Exclusion', 'Exclusion', [...T], [...L], { image: IMG, description: 'Humane one-way exclusion, done outside the maternity season.' }, ['bat removal', 'bat exclusion', 'bats in attic', 'bat control']),
  svc('Bird Control & Nest Removal', 'Exclusion', [...T], [...L], { image: IMG, description: 'Netting, spikes, and nest removal for vents, signs, and ledges.' }, ['bird control', 'bird removal', 'pigeon control', 'nest removal', 'bird netting']),
  svc('Snake Removal', 'Emergency', [...T], [...L], { image: IMG, description: 'Identification and removal, with habitat advice so it does not repeat.' }, ['snake removal', 'snake control', 'snake in house', 'snake catcher']),
  svc('Bee & Wasp Removal', 'Removal', [...T], [...L], { image: IMG, description: 'Live honeybee relocation, and wasp and hornet nest removal.' }, ['bee removal', 'honeybee relocation', 'wasp nest removal', 'hornet removal', 'swarm removal']),
  svc('Skunk Removal & Odor Treatment', 'Removal', [...T], [...L], { image: IMG, description: 'Skunks trapped and removed, with under-deck odour treatment.' }, ['skunk removal', 'skunk control', 'skunk under deck', 'skunk odor']),
  svc('Attic Cleanup & Damage Repair', 'Cleanup', [...T], [...L], { image: IMG, description: 'Contaminated insulation removed, cavity sanitised, and entry points sealed.' }, ['attic cleanup', 'animal damage repair', 'insulation removal', 'attic restoration', 'wildlife exclusion']),
]

export const WILDLIFE_REMOVAL_INDUSTRY: IndustryDef = {
  slug: 'wildlife-removal', label: 'Wildlife Removal',
  keywords: ['wildlife removal', 'animal control', 'animal removal', 'nuisance wildlife', 'critter removal', 'bat removal', 'raccoon removal', 'squirrel removal', 'bee removal', 'snake removal'],
  serviceGroups: ['Removal', 'Exclusion', 'Cleanup', 'Emergency'],
  defaultThemes: [...T],
  defaultLayouts: [...L],
  services: WILDLIFE_REMOVAL_SERVICES,
}
