import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const LOCK_IMG = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64'
const KEY_IMG = 'https://images.unsplash.com/photo-1557939574-a2ef76b4b3ea'

function lock(
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
    industry: 'locksmith',
    keywords,
    widgetCategory: label,
    recommendedThemes: themes,
    recommendedLayouts: layouts,
    catalog,
  }
}

const URGENT_THEMES = ['swift-mobile', 'functional-utility', 'modern-office', 'brutalist'] as const
const URGENT_LAYOUTS = ['emergency-first', 'minimalist-lead', 'compact-quote', 'conversion-focus'] as const

export const LOCKSMITH_SERVICES: ServiceDef[] = [
  lock(
    'Residential Lockout',
    'Emergency',
    [...URGENT_THEMES],
    [...URGENT_LAYOUTS],
    { image: LOCK_IMG, description: 'Locked out? We\'re on the way — 24/7 residential lockout service.' },
    ['locked out', 'home lockout', 'house lockout', 'residential lockout']
  ),
  lock(
    'Car Lockout',
    'Emergency',
    [...URGENT_THEMES],
    [...URGENT_LAYOUTS],
    { image: KEY_IMG, description: 'Keys locked in your car? Fast mobile car lockout service.' },
    ['car lockout', 'locked keys in car', 'auto lockout', 'vehicle lockout']
  ),
  lock(
    'Lock Rekeying',
    'Residential',
    ['swift-mobile', 'modern-office', 'functional-utility', 'classic-warm'],
    ['compact-quote', 'trust-builder', 'conversion-focus', 'local-expert'],
    { image: LOCK_IMG, description: 'Change who can enter without replacing hardware — fast and affordable.' },
    ['rekey', 'lock rekey', 'change locks', 'new keys', 'rekey deadbolt']
  ),
  lock(
    'Lock Installation & Replacement',
    'Residential',
    ['swift-mobile', 'modern-office', 'functional-utility', 'commercial-pro'],
    ['trust-builder', 'compact-quote', 'conversion-focus', 'standard'],
    { image: LOCK_IMG, description: 'Deadbolts, knob sets, and high-security locks installed to code.' },
    ['lock install', 'deadbolt install', 'new lock', 'lock replacement', 'door lock']
  ),
  lock(
    'Smart Lock Installation',
    'Smart Security',
    ['modern-office', 'swift-mobile', 'sleek-entertainment', 'minimalist-zen'],
    ['compact-quote', 'trust-builder', 'conversion-focus'],
    { image: LOCK_IMG, description: 'Keypad, fingerprint, and app-controlled smart locks installed and configured.' },
    ['smart lock install', 'keypad lock', 'keyless entry', 'schlage encode', 'august lock']
  ),
  lock(
    'Commercial Locksmith',
    'Commercial',
    ['commercial-pro', 'swift-mobile', 'modern-office', 'functional-utility'],
    ['trust-builder', 'conversion-focus', 'compact-quote', 'local-expert'],
    { image: LOCK_IMG, description: 'Master key systems, panic bars, and access control for businesses.' },
    ['commercial lock', 'master key system', 'panic bar', 'commercial lockout', 'office lock']
  ),
  lock(
    'Safe Opening & Installation',
    'Specialty',
    ['modern-office', 'swift-mobile', 'commercial-pro', 'functional-utility'],
    ['trust-builder', 'compact-quote', 'conversion-focus'],
    { image: LOCK_IMG, description: 'Locked out of your safe? We open it without damage, or install a new one.' },
    ['safe open', 'safe lockout', 'safe cracking', 'safe install', 'safe service']
  ),
]

export const LOCKSMITH_INDUSTRY: IndustryDef = {
  slug: 'locksmith',
  label: 'Locksmith Services',
  keywords: ['locksmith', 'lockout', 'lock service', 'rekey', 'key cutting', 'lock install'],
  serviceGroups: ['Emergency', 'Residential', 'Smart Security', 'Commercial', 'Specialty'],
  defaultThemes: ['swift-mobile', 'functional-utility', 'modern-office', 'brutalist'],
  defaultLayouts: ['emergency-first', 'minimalist-lead', 'compact-quote', 'conversion-focus'],
  services: LOCKSMITH_SERVICES,
}
