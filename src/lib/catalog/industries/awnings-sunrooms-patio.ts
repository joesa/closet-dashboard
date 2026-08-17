import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64'

function svc(label: string, group: string, themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry: 'awnings-sunrooms-patio', keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['coastal-climate', 'classic-warm', 'functional-utility', 'modern-office'] as const
const L = ['portfolio-first', 'gallery-showcase', 'conversion-focus', 'trust-builder'] as const

export const AWNINGS_SUNROOMS_SERVICES: ServiceDef[] = [
  svc('Retractable Awning Installation', 'Awnings', [...T], [...L], { image: IMG, description: 'Motorised and manual retractable awnings sized to the opening.' }, ['retractable awning', 'awning installation', 'motorized awning', 'patio awning']),
  svc('Fixed & Metal Awnings', 'Awnings', [...T], [...L], { image: IMG, description: 'Permanent aluminium and fabric awnings over doors and windows.' }, ['metal awning', 'fixed awning', 'door awning', 'window awning', 'awning companies']),
  svc('Awning Repair & Recover', 'Awnings', [...T], [...L], { image: IMG, description: 'Torn fabric replaced, arms rebuilt, and motors serviced.' }, ['awning repair', 'awning recover', 'awning fabric replacement', 'repair awnings']),
  svc('Sunroom Construction', 'Sunrooms', [...T], [...L], { image: IMG, description: 'Three and four season rooms built on a new or existing slab.' }, ['sunroom', 'sunroom builder', 'four season room', 'solarium', 'sun porch']),
  svc('Screen Room & Porch Enclosure', 'Sunrooms', [...T], [...L], { image: IMG, description: 'Existing porches screened in, with pet-grade screen where needed.' }, ['screen room', 'porch enclosure', 'screened porch', 'patio enclosure']),
  svc('Patio & Deck Covers', 'Patio Covers', [...T], [...L], { image: IMG, description: 'Insulated and lattice patio covers attached to the house.' }, ['patio cover', 'deck cover', 'covered patio', 'insulated patio cover']),
  svc('Hurricane Shutters & Film', 'Storm Protection', [...T], [...L], { image: IMG, description: 'Accordion, roll-down, and panel shutters plus impact film.' }, ['hurricane shutters', 'hurricane film', 'storm shutters', 'impact film', 'hurricane shutter repair']),
  svc('Balcony & Railing Enclosure', 'Patio Covers', [...T], [...L], { image: IMG, description: 'Balcony covers, screens, and code-height railing work.' }, ['balcony contractor', 'balcony enclosure', 'balcony railing', 'balcony repair']),
]

export const AWNINGS_SUNROOMS_INDUSTRY: IndustryDef = {
  slug: 'awnings-sunrooms-patio', label: 'Awnings, Sunrooms & Patio Covers',
  keywords: ['awning', 'awnings', 'sunroom', 'patio cover', 'screen room', 'pergola cover', 'hurricane shutter', 'balcony', 'four season room'],
  serviceGroups: ['Awnings', 'Sunrooms', 'Patio Covers', 'Storm Protection'],
  defaultThemes: [...T],
  defaultLayouts: [...L],
  services: AWNINGS_SUNROOMS_SERVICES,
}
