import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1493809842364-78817add7ffb'

function svc(label: string, group: string, themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry: 'home-organizing-design', keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['minimalist-zen', 'luxury-minimal', 'wellness-calm', 'elegant-dressing'] as const
const L = ['before-after', 'gallery-showcase', 'conversion-focus', 'storyteller'] as const

export const HOME_ORGANIZING_SERVICES: ServiceDef[] = [
  svc('Whole-Home Organizing', 'Organizing', [...T], [...L], { image: IMG, description: 'Room-by-room sorting, systems, and labels that survive daily use.' }, ['home organizer', 'professional organizer', 'home organizing', 'organizing service']),
  svc('Kitchen & Pantry Organizing', 'Organizing', [...T], [...L], { image: IMG, description: 'Pantry and kitchen zoning around how the household actually cooks.' }, ['pantry organizing', 'kitchen organizing', 'pantry organization', 'cabinet organizing']),
  svc('Closet & Wardrobe Editing', 'Organizing', [...T], [...L], { image: IMG, description: 'Wardrobe editing and closet systems set up for a real morning routine.' }, ['closet organizing', 'wardrobe editing', 'closet organizer', 'clothing organization']),
  svc('Decluttering & Donation Coordination', 'Organizing', [...T], [...L], { image: IMG, description: 'Sorting sessions with donation, sale, and disposal handled for you.' }, ['decluttering', 'declutter service', 'donation pickup coordination', 'clutter removal']),
  svc('Downsizing & Senior Move Management', 'Transitions', [...T], [...L], { image: IMG, description: 'Sorting, floor planning, and settling for a smaller home.' }, ['downsizing', 'senior move management', 'move management', 'estate downsizing']),
  svc('Unpacking & Move-In Setup', 'Transitions', [...T], [...L], { image: IMG, description: 'Boxes unpacked and the new house set up in the first week.' }, ['unpacking service', 'move in organizing', 'new home setup', 'unpacking help']),
  svc('Interior Styling & Space Planning', 'Styling', [...T], [...L], { image: IMG, description: 'Furniture layout, styling, and sourcing using the room you have.' }, ['interior styling', 'space planning', 'room styling', 'home styling', 'decorating service']),
  svc('Feng Shui & Energy Consultation', 'Styling', [...T], [...L], { image: IMG, description: 'Layout consultation in the feng shui tradition, with a written plan.' }, ['feng shui', 'feng shui consultant', 'energy consultation', 'space clearing']),
]

export const HOME_ORGANIZING_INDUSTRY: IndustryDef = {
  slug: 'home-organizing-design', label: 'Home Organizing & Interior Styling',
  keywords: ['home organizer', 'professional organizer', 'decluttering', 'interior styling', 'space planning', 'feng shui', 'downsizing', 'move management'],
  serviceGroups: ['Organizing', 'Styling', 'Transitions'],
  defaultThemes: [...T],
  defaultLayouts: [...L],
  services: HOME_ORGANIZING_SERVICES,
}
