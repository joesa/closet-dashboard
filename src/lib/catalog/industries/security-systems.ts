import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const SEC_IMG = 'https://images.unsplash.com/photo-1558618047-3c8c76ca7d13'
const CAM_IMG = 'https://images.unsplash.com/photo-1555448248-2571daf6344b'

function sec(
  label: string,
  group: string,
  themes: ServiceDef['recommendedThemes'],
  layouts: ServiceDef['recommendedLayouts'],
  catalog: ServiceDef['catalog'],
  keywords: string[] = []
): ServiceDef {
  return {
    label,
    group,
    industry: 'security-systems',
    keywords,
    widgetCategory: label,
    recommendedThemes: themes,
    recommendedLayouts: layouts,
    catalog,
  }
}

const SEC_THEMES = ['home-guardian', 'modern-office', 'commercial-pro', 'swift-mobile'] as const
const SEC_LAYOUTS = ['trust-builder', 'process-steps', 'conversion-focus', 'compact-quote'] as const

export const SECURITY_SYSTEMS_SERVICES: ServiceDef[] = [
  sec(
    'Security Camera Installation',
    'Cameras',
    [...SEC_THEMES, 'sleek-entertainment'],
    [...SEC_LAYOUTS, 'trust-report'],
    { image: CAM_IMG, description: 'Indoor and outdoor HD security cameras installed and configured.' },
    ['security camera', 'cctv install', 'surveillance camera', 'camera system', 'ring install']
  ),
  sec(
    'Alarm System Installation',
    'Alarms',
    ['home-guardian', 'modern-office', 'commercial-pro', 'functional-utility'],
    ['trust-report', 'trust-builder', 'process-steps', 'conversion-focus'],
    { image: SEC_IMG, description: 'Monitored and unmonitored alarm systems installed by licensed technicians.' },
    ['alarm install', 'security alarm', 'burglar alarm', 'alarm system', 'adt install']
  ),
  sec(
    'Smart Home Security',
    'Smart',
    ['home-guardian', 'sleek-entertainment', 'modern-office', 'minimalist-zen'],
    ['process-steps', 'trust-builder', 'compact-quote', 'conversion-focus'],
    { image: SEC_IMG, description: 'Integrated smart locks, cameras, and sensors controlled from your phone.' },
    ['smart home security', 'smart camera', 'smart lock system', 'home automation security', 'ring alarm']
  ),
  sec(
    'Access Control Systems',
    'Access',
    ['commercial-pro', 'home-guardian', 'modern-office', 'swift-mobile'],
    ['trust-report', 'trust-builder', 'compact-quote', 'conversion-focus'],
    { image: SEC_IMG, description: 'Keycard, fob, and biometric access control for offices and facilities.' },
    ['access control', 'keycard system', 'fob access', 'door access system', 'badge reader']
  ),
  sec(
    'Video Doorbell Installation',
    'Cameras',
    ['home-guardian', 'swift-mobile', 'modern-office', 'minimalist-zen'],
    ['compact-quote', 'trust-builder', 'conversion-focus', 'process-steps'],
    { image: CAM_IMG, description: 'Video doorbells installed and connected to your Wi-Fi and phone.' },
    ['doorbell camera', 'video doorbell', 'ring doorbell', 'nest doorbell', 'smart doorbell']
  ),
  sec(
    'Commercial Security System',
    'Commercial',
    ['commercial-pro', 'home-guardian', 'modern-office', 'brutalist'],
    ['trust-report', 'trust-builder', 'conversion-focus', 'compact-quote'],
    { image: SEC_IMG, description: 'End-to-end security solutions for retail, offices, and warehouses.' },
    ['commercial security', 'business security', 'retail security', 'office surveillance']
  ),
  sec(
    'Security System Monitoring',
    'Monitoring',
    ['home-guardian', 'commercial-pro', 'modern-office', 'functional-utility'],
    ['trust-builder', 'trust-report', 'conversion-focus', 'local-expert'],
    { image: SEC_IMG, description: '24/7 professional monitoring with police, fire, and medical dispatch.' },
    ['security monitoring', '24 hour monitoring', 'alarm monitoring', 'central station']
  ),
  sec(
    'Smart Home Installation',
    'Smart',
    ['home-guardian', 'sleek-entertainment', 'modern-office', 'swift-mobile'],
    ['process-steps', 'trust-builder', 'compact-quote', 'conversion-focus'],
    { image: SEC_IMG, description: 'Whole-home automation — smart lighting, thermostats, locks, and hubs.' },
    ['smart home installation', 'smart home', 'home automation', 'smart hub install']
  ),
  sec(
    'Home Theater Installation',
    'Smart',
    ['sleek-entertainment', 'media-theater', 'modern-office', 'swift-mobile'],
    ['visual-impact', 'portfolio-first', 'gallery-showcase', 'trust-builder'],
    { image: SEC_IMG, description: 'Home theater and whole-home audio/video systems designed and installed.' },
    ['home theater installation', 'home theater', 'av installation', 'home audio video', 'surround sound install']
  ),
]

export const SECURITY_SYSTEMS_INDUSTRY: IndustryDef = {
  slug: 'security-systems',
  label: 'Security Systems',
  keywords: ['security', 'security system', 'alarm', 'cctv', 'surveillance', 'security camera', 'access control', 'smart home installation', 'smart home', 'home automation', 'home theater installation', 'home theater'],
  serviceGroups: ['Cameras', 'Alarms', 'Smart', 'Access', 'Commercial', 'Monitoring'],
  defaultThemes: ['home-guardian', 'modern-office', 'commercial-pro', 'swift-mobile'],
  defaultLayouts: ['trust-builder', 'process-steps', 'conversion-focus', 'compact-quote'],
  services: SECURITY_SYSTEMS_SERVICES,
}
