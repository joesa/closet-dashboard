import type { ServiceDef } from '@/lib/catalog/types'

const CLOSET_IMG = 'https://images.unsplash.com/photo-1558211583-d26f610c1eb1'
const GARAGE_IMG = 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81'
const PANTRY_IMG = 'https://images.unsplash.com/photo-1556910103-1c02745a872f'
const OFFICE_IMG = 'https://images.unsplash.com/photo-1524758631624-e2822e304c36'
const KIDS_IMG = 'https://images.unsplash.com/photo-1505693314120-0d443867891c'
const MEDIA_IMG = 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5'
const LAUNDRY_IMG = 'https://images.unsplash.com/photo-1585429371326-7f264a7de3d0'
const CRAFT_IMG = 'https://images.unsplash.com/photo-1452860607046-6d350d744276'
const LIBRARY_IMG = 'https://images.unsplash.com/photo-1507842217343-583bb7270b66'
const MUDROOM_IMG = 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a'
const COMMERCIAL_IMG = 'https://images.unsplash.com/photo-1497366216548-37526070297c'
const REACHIN_IMG = 'https://images.unsplash.com/photo-1595428774223-ef52624120d2'

function closet(
  label: string,
  group: string,
  widgetRoom: ServiceDef['widgetRoom'],
  recommendedThemes: ServiceDef['recommendedThemes'],
  recommendedLayouts: ServiceDef['recommendedLayouts'],
  catalog: ServiceDef['catalog'],
  keywords: string[] = []
): ServiceDef {
  return {
    label,
    group,
    industry: 'custom-closets',
    keywords,
    widgetCategory: widgetRoom ?? label,
    widgetRoom,
    recommendedThemes,
    recommendedLayouts,
    catalog,
  }
}

export const CUSTOM_CLOSETS_SERVICES: ServiceDef[] = [
  closet(
    'Walk-In Closets',
    'Bedroom',
    'Walk-In Closet',
    ['luxury-minimal', 'elegant-dressing', 'luxury-gallery', 'minimalist-zen'],
    ['portfolio-first', 'standard', 'gallery-showcase'],
    { image: CLOSET_IMG, description: 'Luxurious walk-in spaces designed for your lifestyle.' },
    ['walk in', 'walk-in', 'master closet']
  ),
  closet(
    'Reach-In Closets',
    'Bedroom',
    'Reach-In Closet',
    ['functional-utility', 'modern-office', 'luxury-minimal', 'classic-warm'],
    ['standard', 'conversion-focus', 'compact-quote'],
    { image: REACHIN_IMG, description: 'Maximize every inch with precision reach-in designs.' },
    ['reach in', 'reach-in', 'bedroom closet']
  ),
  closet(
    'Kids & Youth Closets',
    'Bedroom',
    'Kid Spaces',
    ['playful-kids', 'kids-playful', 'modern-office', 'classic-warm'],
    ['storyteller', 'standard', 'conversion-focus'],
    { image: KIDS_IMG, description: 'Flexible storage that grows with your family.' },
    ['kids closet', 'youth', 'children']
  ),
  closet(
    'Dressing Rooms & Boutique Storage',
    'Bedroom',
    'Dressing Room',
    ['elegant-dressing', 'luxury-gallery', 'luxury-minimal', 'sophisticated-wine'],
    ['portfolio-first', 'gallery-showcase', 'visual-impact'],
    { image: REACHIN_IMG, description: 'Boutique dressing rooms with display-worthy organization.' },
    ['dressing room', 'boutique', 'wardrobe']
  ),
  closet(
    'Garages & Garage Storage',
    'Garage',
    'Garage',
    ['brutalist', 'garage-industrial', 'functional-utility', 'sleek-entertainment'],
    ['visual-impact', 'portfolio-first', 'conversion-focus'],
    { image: GARAGE_IMG, description: 'High-performance garage storage built to last.' },
    ['garage storage', 'garage organization', 'garage cabinets']
  ),
  closet(
    'Garage Flooring & Slatwall Systems',
    'Garage',
    'Garage',
    ['garage-industrial', 'brutalist', 'functional-utility', 'coastal-climate'],
    ['visual-impact', 'trust-builder', 'conversion-focus'],
    { image: GARAGE_IMG, description: 'Epoxy floors, slatwall, and heavy-duty garage upgrades.' },
    ['epoxy', 'slatwall', 'garage floor']
  ),
  closet(
    'Pantries & Wine Storage',
    'Kitchen & utility',
    'Pantry & Wine',
    ['rustic-pantry', 'pantry-fresh', 'sophisticated-wine', 'wine-cellar', 'classic-warm'],
    ['standard', 'storyteller', 'gallery-showcase'],
    { image: PANTRY_IMG, description: 'Elegant pantries and wine storage for everyday living.' },
    ['pantry', 'wine storage', 'wine cellar', 'butler pantry']
  ),
  closet(
    'Mudrooms & Entryway Lockers',
    'Entry',
    'Mudroom',
    ['mudroom-family', 'functional-utility', 'classic-warm', 'coastal-climate'],
    ['conversion-focus', 'local-expert', 'standard'],
    { image: MUDROOM_IMG, description: 'Drop zones that tame coats, bags, and daily chaos.' },
    ['mudroom', 'entryway', 'lockers', 'drop zone']
  ),
  closet(
    'Home Offices & Built-In Desks',
    'Work',
    'Home Office',
    ['modern-office', 'office-executive', 'minimalist-zen', 'classic-warm'],
    ['conversion-focus', 'storyteller', 'standard'],
    { image: OFFICE_IMG, description: 'Built-in desks and cable-smart home offices.' },
    ['home office', 'built-in desk', 'office built-ins']
  ),
  closet(
    'Wall Beds & Murphy Beds',
    'Sleep & space',
    'Wall Beds',
    ['modern-office', 'functional-utility', 'minimalist-zen', 'classic-warm'],
    ['compact-quote', 'conversion-focus', 'storyteller'],
    { image: KIDS_IMG, description: 'Murphy beds and multi-use rooms that do more.' },
    ['murphy bed', 'wall bed', 'hideaway bed']
  ),
  closet(
    'Entertainment & Media Centers',
    'Media',
    'Entertainment Center',
    ['sleek-entertainment', 'media-theater', 'brutalist', 'luxury-minimal'],
    ['visual-impact', 'portfolio-first', 'standard'],
    { image: MEDIA_IMG, description: 'Media walls and entertainment centers with hidden wire management.' },
    ['media center', 'entertainment center', 'tv wall']
  ),
  closet(
    'Laundry & Utility Rooms',
    'Utility',
    'Laundry Room',
    ['laundry-clean', 'functional-utility', 'modern-office', 'pantry-fresh'],
    ['trust-builder', 'standard', 'conversion-focus'],
    { image: LAUNDRY_IMG, description: 'Laundry rooms with folding zones and smart storage.' },
    ['laundry room', 'utility room', 'laundry storage']
  ),
  closet(
    'Craft, Hobby & Sewing Rooms',
    'Hobby',
    'Craft Room',
    ['creative-craft', 'playful-kids', 'rustic-pantry', 'classic-warm'],
    ['storyteller', 'standard', 'gallery-showcase'],
    { image: CRAFT_IMG, description: 'Dedicated craft and hobby rooms with flexible storage.' },
    ['craft room', 'sewing room', 'hobby room']
  ),
  closet(
    'Home Libraries & Built-In Storage',
    'Built-ins',
    'Home Library',
    ['cozy-library', 'historic-classic', 'classic-warm', 'luxury-minimal'],
    ['storyteller', 'portfolio-first', 'local-expert'],
    { image: LIBRARY_IMG, description: 'Built-in libraries and display shelving for collectors.' },
    ['home library', 'built-in shelving', 'bookcases']
  ),
  closet(
    'Whole-Home Organization',
    'Whole home',
    'Home Storage',
    ['luxury-minimal', 'modern-office', 'functional-utility', 'minimalist-zen'],
    ['trust-builder', 'local-expert', 'standard'],
    { image: CLOSET_IMG, description: 'Whole-home organization from closets to garages.' },
    ['whole home', 'full home organization']
  ),
  closet(
    'Commercial & Office Storage',
    'Commercial',
    'Home Office',
    ['commercial-pro', 'modern-office', 'office-executive', 'functional-utility'],
    ['conversion-focus', 'trust-builder', 'compact-quote'],
    { image: COMMERCIAL_IMG, description: 'Commercial storage for offices, retail, and workspaces.' },
    ['commercial storage', 'office storage', 'retail fixtures']
  ),
]

export const CUSTOM_CLOSETS_GROUPS = [
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
] as const
