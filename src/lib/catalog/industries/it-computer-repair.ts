import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1518770660439-4636190af475'

function it(label: string, group: string, themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry: 'it-computer-repair', keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['modern-office', 'commercial-pro', 'minimalist-zen', 'brutalist'] as const
const L = ['emergency-first', 'trust-builder', 'compact-quote', 'local-expert'] as const

export const IT_COMPUTER_REPAIR_SERVICES: ServiceDef[] = [
  it('On-Site IT Support', 'Support', [...T], [...L, 'service-zones'], { image: IMG, description: 'Flat-fee or hourly on-site IT support for businesses and home offices.' }, ['it support', 'computer help', 'on-site it', 'tech support', 'it technician']),
  it('Virus & Malware Removal', 'Repair', [...T], ['emergency-first', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Same-day virus, spyware, and ransomware removal with free follow-up check.' }, ['virus removal', 'malware removal', 'computer virus', 'ransomware removal', 'spyware']),
  it('Computer Repair (PC & Mac)', 'Repair', [...T], [...L], { image: IMG, description: 'Screen replacement, hardware repair, data recovery, and tune-ups for all brands.' }, ['computer repair', 'pc repair', 'mac repair', 'laptop repair', 'computer fix']),
  it('Managed IT Services', 'Managed', ['commercial-pro', 'modern-office', 'functional-utility', 'brutalist'], ['trust-report', 'trust-builder', 'compact-quote', 'conversion-focus'], { image: IMG, description: 'Proactive monitoring, patching, and helpdesk for small businesses — flat monthly rate.' }, ['managed it', 'msp', 'managed services', 'it management', 'business it support']),
  it('Network & WiFi Setup', 'Network', [...T], ['process-steps', 'trust-builder', 'compact-quote', 'service-zones'], { image: IMG, description: 'Mesh WiFi, structured cabling, and network infrastructure for homes and offices.' }, ['network setup', 'wifi setup', 'mesh wifi', 'network installation', 'structured cabling']),
  it('Data Recovery', 'Recovery', [...T], ['emergency-first', 'trust-builder', 'compact-quote', 'trust-report'], { image: IMG, description: 'Drive recovery for failed hard drives, SSDs, and deleted files — no data, no charge.' }, ['data recovery', 'hard drive recovery', 'deleted files recovery', 'ssd recovery', 'file recovery']),
  it('Security Camera & Smart Home', 'Smart', ['modern-office', 'commercial-pro', 'sleek-entertainment', 'home-guardian'], ['trust-builder', 'process-steps', 'compact-quote', 'service-zones'], { image: IMG, description: 'Smart home setup, security camera installation, and network integration.' }, ['security camera', 'smart home', 'cctv install', 'camera install', 'smart home setup']),
]

export const IT_COMPUTER_REPAIR_INDUSTRY: IndustryDef = {
  slug: 'it-computer-repair', label: 'IT Support & Computer Repair',
  keywords: ['it support', 'computer repair', 'managed it', 'tech support', 'virus removal', 'data recovery', 'network setup'],
  serviceGroups: ['Support', 'Repair', 'Managed', 'Network', 'Recovery', 'Smart'],
  defaultThemes: ['modern-office', 'commercial-pro', 'minimalist-zen', 'brutalist'],
  defaultLayouts: ['emergency-first', 'trust-builder', 'compact-quote', 'local-expert'],
  services: IT_COMPUTER_REPAIR_SERVICES,
}
