import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1518770660439-4636190af475'

function svc(label: string, group: string, themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry: 'home-av-networking', keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['media-theater', 'sleek-entertainment', 'modern-office', 'functional-utility'] as const
const L = ['gallery-showcase', 'conversion-focus', 'trust-builder', 'compact-quote'] as const

export const HOME_AV_NETWORKING_SERVICES: ServiceDef[] = [
  svc('Home Theater Installation', 'Video', [...T], [...L], { image: IMG, description: 'Projector, screen, and surround systems calibrated to the room.' }, ['home theater installation', 'home theatre', 'projector installation', 'surround sound install']),
  svc('Whole-Home Audio', 'Audio', [...T], [...L], { image: IMG, description: 'In-ceiling and multi-room audio zones wired and tuned.' }, ['whole home audio', 'multi room audio', 'in ceiling speakers', 'home audio companies']),
  svc('TV Mounting & Wire Concealment', 'Video', [...T], [...L], { image: IMG, description: 'Televisions mounted flush and level with the wiring hidden in-wall.' }, ['tv mounting', 'tv wall mount', 'tv installation', 'wire concealment']),
  svc('Home Audio Equipment Repair', 'Audio', [...T], [...L], { image: IMG, description: 'Receivers, amplifiers, and vintage stereo gear repaired.' }, ['home audio repair', 'stereo repair', 'amplifier repair', 'receiver repair']),
  svc('TV Antenna Installation', 'Antenna & Satellite', [...T], [...L], { image: IMG, description: 'Over-the-air antennas aimed, mounted, and grounded.' }, ['tv antenna', 'antenna installation', 'ota antenna', 'antenna repair', 'tv antenna services']),
  svc('Satellite TV Installation', 'Antenna & Satellite', [...T], [...L], { image: IMG, description: 'Satellite dishes installed, aligned, and re-pointed after storms.' }, ['satellite tv', 'satellite dish installation', 'dish alignment', 'satellite repair']),
  svc('Home Network & WiFi Installation', 'Networking', [...T], [...L], { image: IMG, description: 'Access points, switches, and structured cable for whole-house coverage.' }, ['home network installation', 'wifi installation', 'structured wiring', 'ethernet wiring', 'mesh wifi']),
  svc('Phone & Intercom Wiring', 'Networking', [...T], [...L], { image: IMG, description: 'Landline, intercom, and door-station wiring installed or traced.' }, ['phone wiring', 'landline phone service', 'intercom installation', 'door station']),
]

export const HOME_AV_NETWORKING_INDUSTRY: IndustryDef = {
  slug: 'home-av-networking', label: 'Home Audio, Video & Networking',
  keywords: ['home audio', 'home theater', 'tv mounting', 'antenna installation', 'satellite tv', 'structured wiring', 'whole home audio', 'av installer', 'smart home wiring'],
  serviceGroups: ['Audio', 'Video', 'Antenna & Satellite', 'Networking'],
  defaultThemes: [...T],
  defaultLayouts: [...L],
  services: HOME_AV_NETWORKING_SERVICES,
}
