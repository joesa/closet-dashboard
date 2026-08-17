import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1518770660439-4636190af475'

function svc(label: string, group: string, themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry: 'electronics-device-repair', keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['modern-office', 'functional-utility', 'swift-mobile', 'brutalist'] as const
const L = ['compact-quote', 'conversion-focus', 'trust-builder', 'local-expert'] as const

export const ELECTRONICS_REPAIR_SERVICES: ServiceDef[] = [
  svc('Phone Screen Replacement', 'Phones', [...T], [...L], { image: IMG, description: 'Cracked screens replaced while you wait, with the part shown to you.' }, ['phone repair', 'screen repair', 'cracked screen', 'iphone screen repair', 'cell phone repair']),
  svc('Phone Battery & Port Repair', 'Phones', [...T], [...L], { image: IMG, description: 'Swollen batteries and worn charge ports replaced.' }, ['phone battery replacement', 'charge port repair', 'battery repair', 'phone not charging']),
  svc('Water Damage Recovery', 'Phones', [...T], [...L], { image: IMG, description: 'Board-level cleaning and drying with data recovery attempted first.' }, ['water damage phone', 'liquid damage repair', 'phone water damage', 'data recovery phone']),
  svc('Tablet Repair', 'Tablets', [...T], [...L], { image: IMG, description: 'Screens, batteries, and charge ports for tablets of any brand.' }, ['tablet repair', 'ipad repair', 'samsung tablet repair', 'tablet screen']),
  svc('Laptop & Computer Screen Repair', 'Tablets', [...T], [...L], { image: IMG, description: 'Cracked laptop panels, hinges, and keyboards replaced.' }, ['laptop screen repair', 'computer screen repair', 'laptop hinge repair', 'keyboard replacement']),
  svc('TV Repair', 'TVs', [...T], [...L], { image: IMG, description: 'Panel, board, and backlight faults diagnosed before you replace the set.' }, ['tv repair', 'samsung tv repair', 'led tv repair', 'television repair', 'tv screen repair']),
  svc('Game Console Repair', 'Consoles', [...T], [...L], { image: IMG, description: 'Drive, HDMI port, and overheating faults on current consoles.' }, ['game console repair', 'playstation repair', 'xbox repair', 'console hdmi repair']),
  svc('Data Transfer & Device Setup', 'Consoles', [...T], [...L], { image: IMG, description: 'Data moved to a new device and the old one wiped properly.' }, ['data transfer', 'device setup', 'phone setup', 'data migration']),
]

export const ELECTRONICS_REPAIR_INDUSTRY: IndustryDef = {
  slug: 'electronics-device-repair', label: 'Electronics & Device Repair',
  keywords: ['phone repair', 'cell phone repair', 'screen repair', 'tablet repair', 'tv repair', 'laptop screen', 'game console repair', 'device repair', 'battery replacement'],
  serviceGroups: ['Phones', 'Tablets', 'TVs', 'Consoles'],
  defaultThemes: [...T],
  defaultLayouts: [...L],
  services: ELECTRONICS_REPAIR_SERVICES,
}
