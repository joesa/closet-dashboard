import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64'

function svc(label: string, group: string, themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry: 'holiday-decorating', keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['classic-warm', 'creative-craft', 'luxury-gallery', 'cozy-library'] as const
const L = ['seasonal-cta', 'gallery-showcase', 'conversion-focus', 'event-booking'] as const

export const HOLIDAY_DECORATING_SERVICES: ServiceDef[] = [
  svc('Christmas Light Installation', 'Lighting', [...T], [...L], { image: IMG, description: 'Roofline, tree, and landscape lighting installed with custom-cut runs.' }, ['christmas lights', 'christmas light installation', 'holiday lighting', 'holiday light installer', 'light hanging']),
  svc('Commercial Holiday Lighting', 'Commercial', [...T], [...L], { image: IMG, description: 'Storefront, plaza, and campus lighting on a maintained contract.' }, ['commercial christmas lights', 'commercial holiday lighting', 'business holiday lights']),
  svc('Holiday Decor Design & Install', 'Decor', [...T], [...L], { image: IMG, description: 'Wreaths, garland, and interior decor designed and installed.' }, ['holiday decorating', 'christmas decorating', 'holiday decorators', 'wreath installation']),
  svc('Tree Setup & Interior Decorating', 'Decor', [...T], [...L], { image: IMG, description: 'Trees delivered, set, lit, and decorated inside the home or lobby.' }, ['christmas tree setup', 'tree decorating', 'interior holiday decor', 'office tree']),
  svc('Takedown, Removal & Storage', 'Takedown', [...T], [...L], { image: IMG, description: 'January removal with everything labelled and stored for next year.' }, ['light takedown', 'holiday light removal', 'decor storage', 'christmas light removal']),
  svc('Lighting Repair & Maintenance', 'Lighting', [...T], [...L], { image: IMG, description: 'Mid-season outages fixed within a day or two of the call.' }, ['light repair', 'holiday light repair', 'christmas light repair', 'light maintenance']),
  svc('Event & Party Lighting', 'Lighting', [...T], [...L], { image: IMG, description: 'Weddings, galas, and parties lit for a single date.' }, ['event lighting', 'party lighting', 'wedding lighting', 'string light rental']),
  svc('Seasonal & Fall Decorating', 'Decor', [...T], [...L], { image: IMG, description: 'Autumn, Halloween, and spring displays installed and removed.' }, ['fall decorating', 'halloween decorating', 'seasonal decor', 'spring decorating']),
]

export const HOLIDAY_DECORATING_INDUSTRY: IndustryDef = {
  slug: 'holiday-decorating', label: 'Holiday & Event Decorating',
  keywords: ['holiday decorating', 'christmas lights', 'holiday lighting', 'light installation', 'holiday decorator', 'seasonal decorating', 'christmas decorating'],
  serviceGroups: ['Lighting', 'Decor', 'Commercial', 'Takedown'],
  defaultThemes: [...T],
  defaultLayouts: [...L],
  services: HOLIDAY_DECORATING_SERVICES,
}
