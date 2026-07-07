import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1507842217343-583bb7270b66'
const KIDS_IMG = 'https://images.unsplash.com/photo-1505693314120-0d443867891c'

function he(
  label: string,
  group: string,
  industry: 'medical-clinic' | 'therapy-rehab' | 'senior-care' | 'education-formal' | 'enrichment-education',
  themes: ServiceDef['recommendedThemes'],
  layouts: ServiceDef['recommendedLayouts'],
  catalog: ServiceDef['catalog'],
  keywords: string[] = []
): ServiceDef {
  return { label, group, industry, keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const MED_T = ['care-comfort', 'modern-office', 'commercial-pro', 'minimalist-zen'] as const
const MED_L = ['trust-builder', 'trust-report', 'local-expert', 'compact-quote'] as const

export const MEDICAL_CLINIC_SERVICES: ServiceDef[] = [
  he('Urgent Care Visit', 'Urgent Care', 'medical-clinic', [...MED_T], [...MED_L], { image: IMG, description: 'Walk-in urgent care for injuries and illness — no appointment needed.' }, ['urgent care', 'walk in clinic', 'urgent care center', 'immediate care']),
  he('Family Clinic Appointment', 'Family Medicine', 'medical-clinic', ['care-comfort', 'classic-warm', 'modern-office', 'wellness-calm'], ['trust-builder', 'storyteller', 'local-expert', 'standard'], { image: IMG, description: 'Primary care and family medicine for patients of all ages.' }, ['family clinic', 'family doctor', 'primary care', 'family medicine']),
  he('Dental Office Visit', 'Dental', 'medical-clinic', ['care-comfort', 'modern-office', 'minimalist-zen', 'classic-warm'], ['trust-builder', 'gallery-showcase', 'before-after', 'local-expert'], { image: IMG, description: 'General and cosmetic dental care from a comfortable, modern office.' }, ['dental office', 'dentist', 'dental clinic', 'family dentist']),
  he('Hospital & Specialty Care', 'Hospital', 'medical-clinic', ['commercial-pro', 'care-comfort', 'modern-office', 'office-executive'], ['trust-report', 'trust-builder', 'standard', 'local-expert'], { image: IMG, description: 'Specialty and hospital-based care with coordinated referrals.' }, ['hospital', 'specialty care', 'medical center', 'inpatient care']),
]

const THER_T = ['wellness-calm', 'care-comfort', 'minimalist-zen', 'classic-warm'] as const
const THER_L = ['storyteller', 'trust-builder', 'process-steps', 'local-expert'] as const

export const THERAPY_REHAB_SERVICES: ServiceDef[] = [
  he('Physical Therapy', 'Physical Therapy', 'therapy-rehab', [...THER_T], [...THER_L], { image: IMG, description: 'Personalized physical therapy plans for injury recovery and mobility.' }, ['physical therapy', 'physical therapist', 'pt clinic', 'rehab therapy']),
  he('Speech Therapy', 'Speech Therapy', 'therapy-rehab', ['wellness-calm', 'playful-kids', 'care-comfort', 'classic-warm'], ['storyteller', 'trust-builder', 'process-steps', 'local-expert'], { image: KIDS_IMG, description: 'Speech and language therapy for children and adults.' }, ['speech therapy', 'speech therapist', 'speech language pathology']),
  he('Mental Health Counseling', 'Mental Health', 'therapy-rehab', ['wellness-calm', 'minimalist-zen', 'care-comfort', 'classic-warm'], ['storyteller', 'trust-builder', 'standard', 'compact-quote'], { image: IMG, description: 'Individual, couples, and family mental health counseling.' }, ['mental health counseling', 'therapist', 'counseling services', 'therapy sessions']),
]

const SENIOR_T = ['care-comfort', 'classic-warm', 'wellness-calm', 'mudroom-family'] as const
const SENIOR_L = ['storyteller', 'trust-builder', 'trust-report', 'local-expert'] as const

export const SENIOR_CARE_SERVICES: ServiceDef[] = [
  he('Nursing Home Care', 'Nursing Home', 'senior-care', [...SENIOR_T], [...SENIOR_L], { image: IMG, description: '24/7 skilled nursing care in a warm, home-like residential setting.' }, ['nursing home', 'skilled nursing', 'long term care', 'nursing care facility']),
  he('Assisted Living', 'Assisted Living', 'senior-care', ['care-comfort', 'classic-warm', 'wellness-calm', 'luxury-minimal'], ['storyteller', 'gallery-showcase', 'trust-builder', 'local-expert'], { image: IMG, description: 'Assisted living residences with personalized care plans and amenities.' }, ['assisted living', 'senior living', 'retirement community', 'senior residence']),
  he('Adult & Child Daycare', 'Daycare', 'senior-care', ['care-comfort', 'playful-kids', 'classic-warm', 'wellness-calm'], ['trust-builder', 'storyteller', 'local-expert', 'standard'], { image: KIDS_IMG, description: 'Licensed adult and child daycare with structured daily activities.' }, ['daycare', 'adult day care', 'child daycare', 'day care center']),
  he('Foster Care Services', 'Foster Care', 'senior-care', ['care-comfort', 'classic-warm', 'mudroom-family', 'wellness-calm'], ['storyteller', 'trust-builder', 'standard', 'local-expert'], { image: KIDS_IMG, description: 'Foster care placement, support, and licensing services.' }, ['foster care', 'foster agency', 'foster placement', 'foster family services']),
]

const EDU_T = ['classic-warm', 'historic-classic', 'modern-office', 'playful-kids'] as const
const EDU_L = ['storyteller', 'gallery-showcase', 'trust-builder', 'standard'] as const

export const EDUCATION_FORMAL_SERVICES: ServiceDef[] = [
  he('University & College Programs', 'Higher Education', 'education-formal', [...EDU_T], [...EDU_L], { image: IMG, description: 'Degree and certificate programs with flexible enrollment options.' }, ['university', 'college', 'degree program', 'higher education']),
  he('K-12 School Enrollment', 'K-12', 'education-formal', ['classic-warm', 'playful-kids', 'historic-classic', 'modern-office'], ['storyteller', 'gallery-showcase', 'trust-builder', 'standard'], { image: KIDS_IMG, description: 'Private and charter K-12 school enrollment and campus tours.' }, ['k-12 school', 'private school', 'charter school', 'elementary school']),
  he('Vocational & Trade College', 'Vocational', 'education-formal', ['modern-office', 'functional-utility', 'classic-warm', 'commercial-pro'], ['process-steps', 'trust-builder', 'storyteller', 'standard'], { image: IMG, description: 'Hands-on vocational training and trade certification programs.' }, ['vocational school', 'trade college', 'trade school', 'certification program']),
]

const ENR_T = ['playful-kids', 'wellness-calm', 'classic-warm', 'modern-office'] as const
const ENR_L = ['process-steps', 'trust-builder', 'local-expert', 'standard'] as const

export const ENRICHMENT_EDUCATION_SERVICES: ServiceDef[] = [
  he('Language School', 'Language', 'enrichment-education', ['classic-warm', 'wellness-calm', 'modern-office', 'playful-kids'], ['process-steps', 'trust-builder', 'local-expert', 'standard'], { image: IMG, description: 'Group and private language classes for adults and children.' }, ['language school', 'language classes', 'esl classes', 'foreign language lessons']),
  he('Music Lessons', 'Music', 'enrichment-education', ['playful-kids', 'cozy-library', 'classic-warm', 'wellness-calm'], ['storyteller', 'trust-builder', 'local-expert', 'standard'], { image: KIDS_IMG, description: 'Private music lessons for piano, guitar, voice, and more.' }, ['music lessons', 'piano lessons', 'guitar lessons', 'voice lessons']),
  he('Driving School', 'Driving', 'enrichment-education', ['modern-office', 'functional-utility', 'classic-warm', 'swift-mobile'], ['process-steps', 'trust-builder', 'compact-quote', 'standard'], { image: IMG, description: 'Teen and adult driving lessons with certified instructors.' }, ['driving school', 'driving lessons', 'drivers ed', 'driving instructor']),
]

export const MEDICAL_CLINIC_INDUSTRY: IndustryDef = {
  slug: 'medical-clinic', label: 'Medical Care',
  engagementModel: 'booking',
  keywords: ['hospital', 'urgent care', 'family clinic', 'dental office', 'medical clinic'],
  serviceGroups: ['Urgent Care', 'Family Medicine', 'Dental', 'Hospital'],
  defaultThemes: [...MED_T],
  defaultLayouts: [...MED_L],
  services: MEDICAL_CLINIC_SERVICES,
}

export const THERAPY_REHAB_INDUSTRY: IndustryDef = {
  slug: 'therapy-rehab', label: 'Therapy & Rehabilitation',
  engagementModel: 'booking',
  keywords: ['physical therapy', 'speech therapy', 'mental health counseling', 'rehab clinic', 'therapist'],
  serviceGroups: ['Physical Therapy', 'Speech Therapy', 'Mental Health'],
  defaultThemes: [...THER_T],
  defaultLayouts: [...THER_L],
  services: THERAPY_REHAB_SERVICES,
}

export const SENIOR_CARE_INDUSTRY: IndustryDef = {
  slug: 'senior-care', label: 'Elderly & Social Care',
  engagementModel: 'booking',
  keywords: ['nursing home', 'assisted living', 'daycare', 'foster care', 'senior care'],
  serviceGroups: ['Nursing Home', 'Assisted Living', 'Daycare', 'Foster Care'],
  defaultThemes: [...SENIOR_T],
  defaultLayouts: [...SENIOR_L],
  services: SENIOR_CARE_SERVICES,
}

export const EDUCATION_FORMAL_INDUSTRY: IndustryDef = {
  slug: 'education-formal', label: 'Formal Education',
  engagementModel: 'booking',
  keywords: ['university', 'college', 'k-12 school', 'vocational school', 'trade college'],
  serviceGroups: ['Higher Education', 'K-12', 'Vocational'],
  defaultThemes: [...EDU_T],
  defaultLayouts: [...EDU_L],
  services: EDUCATION_FORMAL_SERVICES,
}

export const ENRICHMENT_EDUCATION_INDUSTRY: IndustryDef = {
  slug: 'enrichment-education', label: 'Enrichment Education',
  engagementModel: 'booking',
  keywords: ['language school', 'music lessons', 'driving school', 'enrichment program'],
  serviceGroups: ['Tutoring', 'Language', 'Music', 'Driving'],
  defaultThemes: [...ENR_T],
  defaultLayouts: [...ENR_L],
  services: ENRICHMENT_EDUCATION_SERVICES,
}
