import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1557939574-a2ef76b4b3ea'

function ps(label: string, group: string, industry: 'mobile-notary' | 'personal-training' | 'massage-therapy' | 'tutoring', themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry, keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

export const MOBILE_NOTARY_SERVICES: ServiceDef[] = [
  ps('Mobile Notary', 'Notary', 'mobile-notary', ['swift-mobile', 'modern-office', 'commercial-pro', 'minimalist-zen'], ['emergency-first', 'compact-quote', 'minimalist-lead', 'service-zones'], { image: IMG, description: 'We come to you — 24/7 mobile notary service for homes, hospitals, and offices.' }, ['mobile notary', 'notary public', 'traveling notary', 'notary service', 'come to me notary']),
  ps('Loan Signing Agent', 'Signing', 'mobile-notary', ['swift-mobile', 'modern-office', 'commercial-pro', 'classic-warm'], ['compact-quote', 'trust-builder', 'service-zones', 'conversion-focus'], { image: IMG, description: 'Certified loan signing agents for mortgage closings at your location.' }, ['loan signing', 'signing agent', 'mortgage signing', 'notary closing', 'loan documents']),
  ps('Apostille & Authentication', 'Documents', 'mobile-notary', ['modern-office', 'commercial-pro', 'swift-mobile', 'minimalist-zen'], ['trust-report', 'process-steps', 'trust-builder', 'compact-quote'], { image: IMG, description: 'Apostille certification and document authentication for international use.' }, ['apostille', 'document authentication', 'apostille service', 'international documents']),
  ps('Process Serving', 'Legal', 'mobile-notary', ['swift-mobile', 'commercial-pro', 'modern-office', 'functional-utility'], ['trust-report', 'trust-builder', 'compact-quote', 'service-zones'], { image: IMG, description: 'Legal document and subpoena service anywhere in your county — rush available.' }, ['process server', 'process serving', 'serve documents', 'subpoena service', 'legal service']),
]

export const PERSONAL_TRAINING_SERVICES: ServiceDef[] = [
  ps('In-Home Personal Training', 'Fitness', 'personal-training', ['wellness-calm', 'minimalist-zen', 'modern-office', 'classic-warm'], ['storyteller', 'trust-builder', 'local-expert', 'process-steps'], { image: IMG, description: 'One-on-one personal training delivered to your home with all equipment.' }, ['personal training', 'in home personal trainer', 'personal trainer', 'home workout']),
  ps('Online Coaching', 'Fitness', 'personal-training', ['wellness-calm', 'modern-office', 'minimalist-zen', 'commercial-pro'], ['trust-builder', 'storyteller', 'standard', 'process-steps'], { image: IMG, description: 'Custom programming, nutrition coaching, and weekly check-ins via app.' }, ['online coaching', 'online personal trainer', 'virtual training', 'fitness coaching']),
  ps('Group Fitness Classes', 'Fitness', 'personal-training', ['wellness-calm', 'playful-kids', 'classic-warm', 'event-festive'], ['gallery-showcase', 'local-expert', 'storyteller', 'event-booking'], { image: IMG, description: 'Small group and bootcamp-style classes at your home, park, or facility.' }, ['group fitness', 'bootcamp', 'outdoor fitness class', 'group training']),
]

export const MASSAGE_THERAPY_SERVICES: ServiceDef[] = [
  ps('Mobile Massage Therapy', 'Outcall', 'massage-therapy', ['wellness-calm', 'minimalist-zen', 'classic-warm', 'care-comfort'], ['storyteller', 'trust-builder', 'local-expert', 'compact-quote'], { image: IMG, description: 'Licensed massage therapists come to your home or office — table provided.' }, ['mobile massage', 'in home massage', 'outcall massage', 'massage at home']),
  ps('Swedish & Relaxation Massage', 'Modalities', 'massage-therapy', ['wellness-calm', 'minimalist-zen', 'elegant-dressing', 'care-comfort'], ['trust-builder', 'storyteller', 'standard', 'gallery-showcase'], { image: IMG, description: 'Classic Swedish massage for relaxation, stress relief, and improved circulation.' }, ['swedish massage', 'relaxation massage', 'full body massage']),
  ps('Deep Tissue & Sports Massage', 'Modalities', 'massage-therapy', ['wellness-calm', 'functional-utility', 'modern-office', 'classic-warm'], ['trust-builder', 'process-steps', 'conversion-focus', 'local-expert'], { image: IMG, description: 'Deep tissue, trigger point, and sports massage for pain relief and recovery.' }, ['deep tissue massage', 'sports massage', 'trigger point', 'massage therapy']),
  ps('Chair Massage (Corporate)', 'Corporate', 'massage-therapy', ['commercial-pro', 'wellness-calm', 'modern-office', 'classic-warm'], ['event-booking', 'trust-builder', 'compact-quote', 'local-expert'], { image: IMG, description: 'Corporate chair massage events for offices, wellness days, and conferences.' }, ['chair massage', 'corporate massage', 'office massage', 'event massage']),
]

export const TUTORING_SERVICES: ServiceDef[] = [
  ps('K-12 Academic Tutoring', 'Academics', 'tutoring', ['wellness-calm', 'playful-kids', 'classic-warm', 'care-comfort'], ['trust-builder', 'process-steps', 'local-expert', 'standard'], { image: IMG, description: 'In-home and online tutoring for all K-12 subjects and grade levels.' }, ['tutoring', 'academic tutoring', 'home tutoring', 'math tutor', 'reading tutor']),
  ps('SAT / ACT Test Prep', 'Test Prep', 'tutoring', ['modern-office', 'wellness-calm', 'classic-warm', 'commercial-pro'], ['process-steps', 'trust-builder', 'trust-report', 'conversion-focus'], { image: IMG, description: 'Personalized SAT, ACT, and college entrance exam prep with score guarantees.' }, ['sat prep', 'act prep', 'test prep', 'college prep', 'exam prep']),
  ps('Online Tutoring', 'Online', 'tutoring', ['modern-office', 'minimalist-zen', 'wellness-calm', 'classic-warm'], ['trust-builder', 'compact-quote', 'standard', 'service-zones'], { image: IMG, description: 'Live virtual tutoring sessions via Zoom — available anywhere, any schedule.' }, ['online tutoring', 'virtual tutor', 'remote tutoring', 'zoom tutoring']),
]

export const MOBILE_NOTARY_INDUSTRY: IndustryDef = {
  slug: 'mobile-notary', label: 'Mobile Notary & Legal Documents',
  keywords: ['mobile notary', 'notary public', 'loan signing', 'apostille', 'process server'],
  serviceGroups: ['Notary', 'Signing', 'Documents', 'Legal'],
  defaultThemes: ['swift-mobile', 'modern-office', 'commercial-pro', 'minimalist-zen'],
  defaultLayouts: ['emergency-first', 'compact-quote', 'service-zones', 'trust-builder'],
  services: MOBILE_NOTARY_SERVICES,
}

export const PERSONAL_TRAINING_INDUSTRY: IndustryDef = {
  slug: 'personal-training', label: 'Personal Training & Fitness',
  keywords: ['personal trainer', 'personal training', 'fitness coach', 'in-home training', 'online coaching'],
  serviceGroups: ['Fitness'],
  defaultThemes: ['wellness-calm', 'minimalist-zen', 'modern-office', 'classic-warm'],
  defaultLayouts: ['storyteller', 'trust-builder', 'local-expert', 'process-steps'],
  services: PERSONAL_TRAINING_SERVICES,
}

export const MASSAGE_THERAPY_INDUSTRY: IndustryDef = {
  slug: 'massage-therapy', label: 'Massage Therapy',
  engagementModel: 'booking',
  keywords: ['massage therapy', 'mobile massage', 'massage therapist', 'deep tissue', 'swedish massage'],
  serviceGroups: ['Outcall', 'Modalities', 'Corporate'],
  defaultThemes: ['wellness-calm', 'minimalist-zen', 'classic-warm', 'care-comfort'],
  defaultLayouts: ['storyteller', 'trust-builder', 'local-expert', 'compact-quote'],
  services: MASSAGE_THERAPY_SERVICES,
}

export const TUTORING_INDUSTRY: IndustryDef = {
  slug: 'tutoring', label: 'Tutoring & Test Prep',
  keywords: ['tutoring', 'tutor', 'academic tutoring', 'sat prep', 'act prep', 'online tutoring', 'test prep'],
  serviceGroups: ['Academics', 'Test Prep', 'Online'],
  defaultThemes: ['wellness-calm', 'playful-kids', 'classic-warm', 'modern-office'],
  defaultLayouts: ['trust-builder', 'process-steps', 'local-expert', 'standard'],
  services: TUTORING_SERVICES,
}
