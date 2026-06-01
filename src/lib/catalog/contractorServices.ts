import type { RoomType } from '@/lib/rooms'
import {
  type LayoutSlug,
  type ThemeSlug,
  THEME_SLUGS,
} from '@/lib/catalog/sitePresentationCatalog'

export type ServiceGroup =
  | 'Bedroom'
  | 'Garage'
  | 'Kitchen & utility'
  | 'Entry'
  | 'Work'
  | 'Sleep & space'
  | 'Media'
  | 'Utility'
  | 'Hobby'
  | 'Built-ins'
  | 'Whole home'
  | 'Commercial'

export type ContractorServiceDef = {
  label: string
  group: ServiceGroup
  widgetRoom: RoomType
  recommendedThemes: ThemeSlug[]
  recommendedLayouts: LayoutSlug[]
  catalog: { image: string; description: string }
}

export const OTHER_SERVICE_LABEL = 'Other (describe below)'

export const CONTRACTOR_SERVICES: ContractorServiceDef[] = [
  {
    label: 'Walk-In Closets',
    group: 'Bedroom',
    widgetRoom: 'Walk-In Closet',
    recommendedThemes: ['luxury-minimal', 'elegant-dressing', 'luxury-gallery', 'minimalist-zen'],
    recommendedLayouts: ['portfolio-first', 'standard', 'gallery-showcase'],
    catalog: {
      image: 'https://images.unsplash.com/photo-1558211583-d26f610c1eb1',
      description: 'Luxurious walk-in spaces designed for your lifestyle.',
    },
  },
  {
    label: 'Reach-In Closets',
    group: 'Bedroom',
    widgetRoom: 'Reach-In Closet',
    recommendedThemes: ['functional-utility', 'modern-office', 'luxury-minimal', 'classic-warm'],
    recommendedLayouts: ['standard', 'conversion-focus', 'compact-quote'],
    catalog: {
      image: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2',
      description: 'Maximize every inch with precision reach-in designs.',
    },
  },
  {
    label: 'Kids & Youth Closets',
    group: 'Bedroom',
    widgetRoom: 'Kid Spaces',
    recommendedThemes: ['playful-kids', 'kids-playful', 'modern-office', 'classic-warm'],
    recommendedLayouts: ['storyteller', 'standard', 'conversion-focus'],
    catalog: {
      image: 'https://images.unsplash.com/photo-1505693314120-0d443867891c',
      description: 'Flexible storage that grows with your family.',
    },
  },
  {
    label: 'Dressing Rooms & Boutique Storage',
    group: 'Bedroom',
    widgetRoom: 'Dressing Room',
    recommendedThemes: ['elegant-dressing', 'luxury-gallery', 'luxury-minimal', 'sophisticated-wine'],
    recommendedLayouts: ['portfolio-first', 'gallery-showcase', 'visual-impact'],
    catalog: {
      image: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2',
      description: 'Boutique dressing rooms with display-worthy organization.',
    },
  },
  {
    label: 'Garages & Garage Storage',
    group: 'Garage',
    widgetRoom: 'Garage',
    recommendedThemes: ['brutalist', 'garage-industrial', 'functional-utility', 'sleek-entertainment'],
    recommendedLayouts: ['visual-impact', 'portfolio-first', 'conversion-focus'],
    catalog: {
      image: 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81',
      description: 'High-performance garage storage built to last.',
    },
  },
  {
    label: 'Garage Flooring & Slatwall Systems',
    group: 'Garage',
    widgetRoom: 'Garage',
    recommendedThemes: ['garage-industrial', 'brutalist', 'functional-utility', 'coastal-climate'],
    recommendedLayouts: ['visual-impact', 'trust-builder', 'conversion-focus'],
    catalog: {
      image: 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81',
      description: 'Epoxy floors, slatwall, and heavy-duty garage upgrades.',
    },
  },
  {
    label: 'Pantries & Wine Storage',
    group: 'Kitchen & utility',
    widgetRoom: 'Pantry & Wine',
    recommendedThemes: ['rustic-pantry', 'pantry-fresh', 'sophisticated-wine', 'wine-cellar', 'classic-warm'],
    recommendedLayouts: ['standard', 'storyteller', 'gallery-showcase'],
    catalog: {
      image: 'https://images.unsplash.com/photo-1556910103-1c02745a872f',
      description: 'Elegant pantries and wine storage for everyday living.',
    },
  },
  {
    label: 'Mudrooms & Entryway Lockers',
    group: 'Entry',
    widgetRoom: 'Mudroom',
    recommendedThemes: ['mudroom-family', 'functional-utility', 'classic-warm', 'coastal-climate'],
    recommendedLayouts: ['conversion-focus', 'local-expert', 'standard'],
    catalog: {
      image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a',
      description: 'Drop zones that tame coats, bags, and daily chaos.',
    },
  },
  {
    label: 'Home Offices & Built-In Desks',
    group: 'Work',
    widgetRoom: 'Home Office',
    recommendedThemes: ['modern-office', 'office-executive', 'minimalist-zen', 'classic-warm'],
    recommendedLayouts: ['conversion-focus', 'storyteller', 'standard'],
    catalog: {
      image: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36',
      description: 'Built-in desks and cable-smart home offices.',
    },
  },
  {
    label: 'Wall Beds & Murphy Beds',
    group: 'Sleep & space',
    widgetRoom: 'Wall Beds',
    recommendedThemes: ['modern-office', 'functional-utility', 'minimalist-zen', 'classic-warm'],
    recommendedLayouts: ['compact-quote', 'conversion-focus', 'storyteller'],
    catalog: {
      image: 'https://images.unsplash.com/photo-1505693314120-0d443867891c',
      description: 'Murphy beds and multi-use rooms that do more.',
    },
  },
  {
    label: 'Entertainment & Media Centers',
    group: 'Media',
    widgetRoom: 'Entertainment Center',
    recommendedThemes: ['sleek-entertainment', 'media-theater', 'brutalist', 'luxury-minimal'],
    recommendedLayouts: ['visual-impact', 'portfolio-first', 'standard'],
    catalog: {
      image: 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5',
      description: 'Media walls and entertainment centers with hidden wire management.',
    },
  },
  {
    label: 'Laundry & Utility Rooms',
    group: 'Utility',
    widgetRoom: 'Laundry Room',
    recommendedThemes: ['laundry-clean', 'functional-utility', 'modern-office', 'pantry-fresh'],
    recommendedLayouts: ['trust-builder', 'standard', 'conversion-focus'],
    catalog: {
      image: 'https://images.unsplash.com/photo-1585429371326-7f264a7de3d0',
      description: 'Laundry rooms with folding zones and smart storage.',
    },
  },
  {
    label: 'Craft, Hobby & Sewing Rooms',
    group: 'Hobby',
    widgetRoom: 'Craft Room',
    recommendedThemes: ['creative-craft', 'playful-kids', 'rustic-pantry', 'classic-warm'],
    recommendedLayouts: ['storyteller', 'standard', 'gallery-showcase'],
    catalog: {
      image: 'https://images.unsplash.com/photo-1452860607046-6d350d744276',
      description: 'Dedicated craft and hobby rooms with flexible storage.',
    },
  },
  {
    label: 'Home Libraries & Built-In Storage',
    group: 'Built-ins',
    widgetRoom: 'Home Library',
    recommendedThemes: ['cozy-library', 'historic-classic', 'classic-warm', 'luxury-minimal'],
    recommendedLayouts: ['storyteller', 'portfolio-first', 'local-expert'],
    catalog: {
      image: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66',
      description: 'Built-in libraries and display shelving for collectors.',
    },
  },
  {
    label: 'Whole-Home Organization',
    group: 'Whole home',
    widgetRoom: 'Home Storage',
    recommendedThemes: ['luxury-minimal', 'modern-office', 'functional-utility', 'minimalist-zen'],
    recommendedLayouts: ['trust-builder', 'local-expert', 'standard'],
    catalog: {
      image: 'https://images.unsplash.com/photo-1558211583-d26f610c1eb1',
      description: 'Whole-home organization from closets to garages.',
    },
  },
  {
    label: 'Commercial & Office Storage',
    group: 'Commercial',
    widgetRoom: 'Home Office',
    recommendedThemes: ['commercial-pro', 'modern-office', 'office-executive', 'functional-utility'],
    recommendedLayouts: ['conversion-focus', 'trust-builder', 'compact-quote'],
    catalog: {
      image: 'https://images.unsplash.com/photo-1497366216548-37526070297c',
      description: 'Commercial storage for offices, retail, and workspaces.',
    },
  },
]

export const SERVICE_LABELS = CONTRACTOR_SERVICES.map((s) => s.label)

export const SERVICE_GROUPS_ORDER: ServiceGroup[] = [
  'Bedroom',
  'Garage',
  'Kitchen & utility',
  'Entry',
  'Work',
  'Sleep & space',
  'Media',
  'Utility',
  'Hobby',
  'Built-ins',
  'Whole home',
  'Commercial',
]

export function getServiceDef(label: string): ContractorServiceDef | undefined {
  return CONTRACTOR_SERVICES.find((s) => s.label === label)
}

export function servicesByGroup(): Map<ServiceGroup, ContractorServiceDef[]> {
  const map = new Map<ServiceGroup, ContractorServiceDef[]>()
  for (const g of SERVICE_GROUPS_ORDER) map.set(g, [])
  for (const s of CONTRACTOR_SERVICES) {
    map.get(s.group)!.push(s)
  }
  return map
}

export function getServiceCatalogEntry(
  serviceName: string
): { image: string; description: string } {
  const def = getServiceDef(serviceName)
  if (def) return def.catalog
  return {
    image: 'https://images.unsplash.com/photo-1558211583-d26f610c1eb1',
    description: 'Premium custom storage solution.',
  }
}

export function widgetRoomForService(label: string): RoomType {
  return getServiceDef(label)?.widgetRoom ?? 'Walk-In Closet'
}

export function collectThemeLayoutPools(
  serviceLabels: string[],
  otherServices?: string | null
): { themes: ThemeSlug[]; layouts: LayoutSlug[] } {
  const themeSet = new Set<ThemeSlug>()
  const layoutSet = new Set<LayoutSlug>()

  for (const label of serviceLabels) {
    const def = getServiceDef(label)
    if (!def) continue
    def.recommendedThemes.forEach((t) => themeSet.add(t))
    def.recommendedLayouts.forEach((l) => layoutSet.add(l))
  }

  const other = (otherServices || '').toLowerCase()
  if (other.includes('wine') || other.includes('cellar')) {
    ;['sophisticated-wine', 'wine-cellar', 'rustic-pantry'].forEach((t) =>
      themeSet.add(t as ThemeSlug)
    )
  }
  if (other.includes('garage') || other.includes('slatwall') || other.includes('epoxy')) {
    ;['garage-industrial', 'brutalist', 'functional-utility'].forEach((t) =>
      themeSet.add(t as ThemeSlug)
    )
    ;['visual-impact', 'conversion-focus'].forEach((l) => layoutSet.add(l as LayoutSlug))
  }
  if (other.includes('mudroom') || other.includes('entry') || other.includes('locker')) {
    themeSet.add('mudroom-family')
    layoutSet.add('local-expert')
  }
  if (other.includes('murphy') || other.includes('wall bed')) {
    themeSet.add('modern-office')
    layoutSet.add('compact-quote')
  }
  if (other.includes('commercial') || other.includes('office')) {
    themeSet.add('commercial-pro')
    layoutSet.add('trust-builder')
  }

  if (themeSet.size === 0) {
    THEME_SLUGS.slice(0, 8).forEach((t) => themeSet.add(t))
  }
  if (layoutSet.size === 0) {
    ;['standard', 'conversion-focus', 'portfolio-first'].forEach((l) =>
      layoutSet.add(l as LayoutSlug)
    )
  }

  return { themes: [...themeSet], layouts: [...layoutSet] }
}
