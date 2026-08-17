import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1581578731548-c64695cc6952'

function gm(label: string, group: string, industry: 'glass-mirror' | 'blinds-shutters', themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry, keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const GT = ['luxury-minimal', 'window-light', 'minimalist-zen', 'modern-office'] as const
const GL = ['gallery-showcase', 'portfolio-first', 'before-after', 'visual-impact'] as const
const BT = ['window-light', 'luxury-minimal', 'classic-warm', 'minimalist-zen'] as const
const BL = ['gallery-showcase', 'portfolio-first', 'before-after', 'conversion-focus'] as const

export const GLASS_MIRROR_SERVICES: ServiceDef[] = [
  gm('Frameless Shower Door & Enclosure', 'Shower', 'glass-mirror', [...GT], [...GL, 'conversion-focus'], { image: IMG, description: 'Custom frameless and semi-frameless shower enclosures installed to spec.' }, ['frameless shower door', 'shower enclosure', 'glass shower door', 'shower glass install']),
  gm('Custom Mirror Installation', 'Mirrors', 'glass-mirror', ['luxury-minimal', 'elegant-dressing', 'modern-office', 'minimalist-zen'], ['gallery-showcase', 'portfolio-first', 'visual-impact', 'conversion-focus'], { image: IMG, description: 'Gym, bathroom, and decorative mirrors cut and installed to any size.' }, ['custom mirror', 'mirror install', 'gym mirror', 'bathroom mirror', 'wall mirror']),
  gm('Glass Shelves & Railing', 'Architectural', 'glass-mirror', [...GT], ['portfolio-first', 'visual-impact', 'gallery-showcase', 'standard'], { image: IMG, description: 'Tempered glass shelving, floating glass panels, and stair railings.' }, ['glass shelves', 'glass railing', 'glass stair railing', 'glass balustrade']),
  gm('Replacement Glass', 'Repair', 'glass-mirror', ['window-light', 'warm-handyman', 'functional-utility', 'modern-office'], ['compact-quote', 'trust-builder', 'before-after', 'local-expert'], { image: IMG, description: 'Window glass, table glass, and furniture glass cut and replaced.' }, ['glass replacement', 'broken glass', 'replace glass', 'window glass cut', 'table glass']),
  gm('Window Glass Replacement', 'Repair', 'glass-mirror', ['luxury-minimal', 'window-light', 'minimalist-zen', 'modern-office'], ['gallery-showcase', 'portfolio-first', 'before-after', 'visual-impact'], { image: IMG, description: 'Failed insulated units and broken panes replaced in the existing frame.' }, ['window glass repair', 'glass replacement', 'broken window glass', 'insulated glass replacement']),
  gm('Storefront & Commercial Glass', 'Architectural', 'glass-mirror', ['luxury-minimal', 'window-light', 'minimalist-zen', 'modern-office'], ['gallery-showcase', 'portfolio-first', 'before-after', 'visual-impact'], { image: IMG, description: 'Storefront glazing, doors, and closers installed and repaired.' }, ['storefront glass', 'commercial glass', 'glazier', 'glass contractors']),
  gm('Glass Block Installation', 'Architectural', 'glass-mirror', ['luxury-minimal', 'window-light', 'minimalist-zen', 'modern-office'], ['gallery-showcase', 'portfolio-first', 'before-after', 'visual-impact'], { image: IMG, description: 'Glass block walls, windows, and showers laid and grouted.' }, ['glass block', 'glass block windows', 'block window install']),
  gm('Antique & Stained Glass Repair', 'Repair', 'glass-mirror', ['luxury-minimal', 'window-light', 'minimalist-zen', 'modern-office'], ['gallery-showcase', 'portfolio-first', 'before-after', 'visual-impact'], { image: IMG, description: 'Leaded and stained panels re-leaded and re-puttied.' }, ['stained glass repair', 'leaded glass', 'antique glass repair']),
]

export const BLINDS_SHUTTERS_SERVICES: ServiceDef[] = [
  gm('Blinds Installation', 'Blinds', 'blinds-shutters', [...BT], [...BL, 'compact-quote'], { image: IMG, description: 'Faux wood, real wood, and aluminum blinds measured and installed.' }, ['blinds install', 'window blinds', 'blinds installation', 'custom blinds']),
  gm('Plantation Shutters', 'Shutters', 'blinds-shutters', ['luxury-minimal', 'window-light', 'classic-warm', 'elegant-dressing'], ['gallery-showcase', 'portfolio-first', 'visual-impact', 'storyteller'], { image: IMG, description: 'Custom plantation shutters in wood, poly, and composite. All sizes.' }, ['plantation shutters', 'interior shutters', 'shutter install', 'wood shutters']),
  gm('Roller & Solar Shades', 'Shades', 'blinds-shutters', [...BT], [...BL], { image: IMG, description: 'Roller, cellular, and solar shades for light control and energy efficiency.' }, ['roller shades', 'solar shades', 'cellular shades', 'window shades', 'honeycomb shades']),
  gm('Motorized & Smart Blinds', 'Smart', 'blinds-shutters', ['luxury-minimal', 'sleek-entertainment', 'modern-office', 'minimalist-zen'], ['compact-quote', 'process-steps', 'trust-builder', 'gallery-showcase'], { image: IMG, description: 'App and voice-controlled motorized blinds and shades installed.' }, ['motorized blinds', 'smart blinds', 'automated shades', 'remote blinds']),
  gm('Blind & Shade Repair', 'Blinds', 'blinds-shutters', ['window-light', 'luxury-minimal', 'classic-warm', 'minimalist-zen'], ['gallery-showcase', 'portfolio-first', 'before-after', 'conversion-focus'], { image: IMG, description: 'Broken cords, tilters, and lift mechanisms repaired in place.' }, ['blind repair', 'shade repair', 'window shade repair', 'blind cord repair']),
  gm('Drapery & Curtain Installation', 'Shades', 'blinds-shutters', ['window-light', 'luxury-minimal', 'classic-warm', 'minimalist-zen'], ['gallery-showcase', 'portfolio-first', 'before-after', 'conversion-focus'], { image: IMG, description: 'Rods, tracks, and drapery hung level and hemmed to the floor.' }, ['drapery installation', 'curtain installation', 'drapery repair', 'curtain rods']),
  gm('Window Screen Repair & Replacement', 'Blinds', 'blinds-shutters', ['window-light', 'luxury-minimal', 'classic-warm', 'minimalist-zen'], ['gallery-showcase', 'portfolio-first', 'before-after', 'conversion-focus'], { image: IMG, description: 'Screens re-meshed and frames rebuilt, including pet-grade mesh.' }, ['window screen repair', 'screen replacement', 'rescreening', 'screen repair']),
  gm('Commercial Window Coverings', 'Smart', 'blinds-shutters', ['window-light', 'luxury-minimal', 'classic-warm', 'minimalist-zen'], ['gallery-showcase', 'portfolio-first', 'before-after', 'conversion-focus'], { image: IMG, description: 'Office and hospitality blinds specified and installed by floor.' }, ['commercial blinds', 'office window coverings', 'hospitality blinds']),
]

export const GLASS_MIRROR_INDUSTRY: IndustryDef = {
  slug: 'glass-mirror', label: 'Glass & Mirror Installation',
  keywords: ['glass', 'mirror', 'shower door', 'glass installation', 'custom mirror', 'glass railing', 'glazier', 'glaziers', 'commercial glass', 'storefront glass', 'glass replacement', 'commercial window', 'window company'],
  serviceGroups: ['Shower', 'Mirrors', 'Architectural', 'Repair'],
  defaultThemes: ['luxury-minimal', 'window-light', 'minimalist-zen', 'modern-office'],
  defaultLayouts: ['gallery-showcase', 'portfolio-first', 'before-after', 'visual-impact'],
  services: GLASS_MIRROR_SERVICES,
}

export const BLINDS_SHUTTERS_INDUSTRY: IndustryDef = {
  slug: 'blinds-shutters', label: 'Blinds & Window Treatments',
  keywords: ['blinds', 'shutters', 'window treatments', 'window coverings', 'shades', 'plantation shutters', 'motorized blinds', 'blind repair', 'window shades', 'shade repair', 'curtains', 'drapery', 'draperies', 'window screen', 'screen repair', 'shutter repair', 'hurricane shutters', 'window shutter', 'shutter companies'],
  serviceGroups: ['Blinds', 'Shutters', 'Shades', 'Smart'],
  defaultThemes: ['window-light', 'luxury-minimal', 'classic-warm', 'minimalist-zen'],
  defaultLayouts: ['gallery-showcase', 'portfolio-first', 'before-after', 'conversion-focus'],
  services: BLINDS_SHUTTERS_SERVICES,
}
