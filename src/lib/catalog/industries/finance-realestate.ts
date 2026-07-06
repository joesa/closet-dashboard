import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1497366216548-37526070297c'

function fi(
  label: string,
  group: string,
  industry: 'banking-lending' | 'investment-services' | 'insurance-services' | 'real-estate-services',
  themes: ServiceDef['recommendedThemes'],
  layouts: ServiceDef['recommendedLayouts'],
  catalog: ServiceDef['catalog'],
  keywords: string[] = []
): ServiceDef {
  return { label, group, industry, keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const BANK_T = ['commercial-pro', 'office-executive', 'luxury-minimal', 'modern-office'] as const
const BANK_L = ['trust-builder', 'trust-report', 'conversion-focus', 'standard'] as const

export const BANKING_LENDING_SERVICES: ServiceDef[] = [
  fi('Commercial Banking', 'Banking', 'banking-lending', [...BANK_T], [...BANK_L], { image: IMG, description: 'Business checking, lending, and treasury services for growing companies.' }, ['commercial bank', 'business banking', 'bank branch', 'business checking']),
  fi('Credit Union Membership', 'Credit Union', 'banking-lending', ['commercial-pro', 'classic-warm', 'office-executive', 'modern-office'], ['trust-builder', 'storyteller', 'conversion-focus', 'standard'], { image: IMG, description: 'Member-owned credit union banking, loans, and savings accounts.' }, ['credit union', 'credit union membership', 'member banking']),
  fi('Mortgage Brokerage', 'Mortgage', 'banking-lending', ['commercial-pro', 'office-executive', 'luxury-minimal', 'classic-warm'], ['trust-builder', 'conversion-focus', 'trust-report', 'standard'], { image: IMG, description: 'Mortgage shopping and pre-approval across dozens of lenders.' }, ['mortgage broker', 'mortgage brokerage', 'home loan', 'mortgage pre approval']),
  fi('Payday & Short-Term Loans', 'Lending', 'banking-lending', ['commercial-pro', 'modern-office', 'functional-utility', 'office-executive'], ['compact-quote', 'conversion-focus', 'standard', 'emergency-first'], { image: IMG, description: 'Fast short-term and payday loans with same-day funding.' }, ['payday loan', 'short term loan', 'cash advance', 'quick loan']),
]

const INV_T = ['office-executive', 'luxury-minimal', 'commercial-pro', 'historic-classic'] as const
const INV_L = ['trust-builder', 'trust-report', 'storyteller', 'conversion-focus'] as const

export const INVESTMENT_SERVICES_SERVICES: ServiceDef[] = [
  fi('Wealth Management', 'Wealth Management', 'investment-services', [...INV_T], [...INV_L], { image: IMG, description: 'Personalized wealth management and financial planning for individuals.' }, ['wealth management', 'financial planner', 'wealth advisor', 'financial advisory']),
  fi('Stock Brokerage', 'Brokerage', 'investment-services', ['office-executive', 'commercial-pro', 'modern-office', 'luxury-minimal'], ['trust-builder', 'conversion-focus', 'trust-report', 'standard'], { image: IMG, description: 'Full-service and self-directed stock brokerage accounts.' }, ['stock brokerage', 'brokerage firm', 'investment account', 'trading account']),
  fi('Venture Capital & Private Equity', 'Venture Capital', 'investment-services', ['office-executive', 'luxury-minimal', 'historic-classic', 'commercial-pro'], ['storyteller', 'trust-builder', 'portfolio-first', 'standard'], { image: IMG, description: 'Venture capital and private equity investment for growth-stage companies.' }, ['venture capital', 'private equity', 'vc firm', 'growth capital']),
]

const INS_T = ['commercial-pro', 'modern-office', 'office-executive', 'functional-utility'] as const
const INS_L = ['trust-builder', 'trust-report', 'compact-quote', 'conversion-focus'] as const

export const INSURANCE_SERVICES_SERVICES: ServiceDef[] = [
  fi('Insurance Underwriting', 'Underwriting', 'insurance-services', [...INS_T], [...INS_L], { image: IMG, description: 'Risk assessment and policy underwriting for individuals and businesses.' }, ['insurance underwriting', 'underwriter', 'policy underwriting']),
  fi('Insurance Brokerage', 'Brokerage', 'insurance-services', ['commercial-pro', 'office-executive', 'modern-office', 'classic-warm'], ['trust-builder', 'conversion-focus', 'trust-report', 'standard'], { image: IMG, description: 'Independent insurance brokerage comparing quotes across top carriers.' }, ['insurance broker', 'insurance brokerage', 'insurance agent', 'insurance quote']),
  fi('Claims Adjusting', 'Claims', 'insurance-services', ['commercial-pro', 'modern-office', 'functional-utility', 'office-executive'], ['trust-report', 'process-steps', 'compact-quote', 'standard'], { image: IMG, description: 'Independent claims adjusting and damage assessment services.' }, ['claims adjuster', 'claims adjusting', 'insurance claims', 'damage assessment']),
]

const RE_T = ['luxury-gallery', 'luxury-minimal', 'commercial-pro', 'coastal-climate'] as const
const RE_L = ['gallery-showcase', 'portfolio-first', 'trust-builder', 'conversion-focus'] as const

export const REAL_ESTATE_SERVICES_SERVICES: ServiceDef[] = [
  fi('Property Management', 'Management', 'real-estate-services', ['commercial-pro', 'modern-office', 'functional-utility', 'luxury-minimal'], ['trust-builder', 'service-zones', 'trust-report', 'standard'], { image: IMG, description: 'Full-service property management for landlords and investors.' }, ['property management', 'property manager', 'rental management', 'landlord services']),
  fi('Real Estate Brokerage', 'Brokerage', 'real-estate-services', [...RE_T], [...RE_L], { image: IMG, description: 'Buying, selling, and listing representation from local real estate experts.' }, ['real estate brokerage', 'real estate agent', 'realtor', 'home buying']),
  fi('Property Appraisal', 'Appraisal', 'real-estate-services', ['commercial-pro', 'office-executive', 'luxury-minimal', 'functional-utility'], ['trust-report', 'compact-quote', 'trust-builder', 'standard'], { image: IMG, description: 'Certified residential and commercial property appraisals.' }, ['property appraisal', 'home appraisal', 'appraiser', 'real estate appraisal']),
]

export const BANKING_LENDING_INDUSTRY: IndustryDef = {
  slug: 'banking-lending', label: 'Banking & Lending',
  keywords: ['commercial bank', 'credit union', 'mortgage broker', 'payday loan', 'lending'],
  serviceGroups: ['Banking', 'Credit Union', 'Mortgage', 'Lending'],
  defaultThemes: [...BANK_T],
  defaultLayouts: [...BANK_L],
  services: BANKING_LENDING_SERVICES,
}

export const INVESTMENT_SERVICES_INDUSTRY: IndustryDef = {
  slug: 'investment-services', label: 'Investment Services',
  keywords: ['wealth management', 'stock brokerage', 'venture capital', 'private equity', 'financial advisor'],
  serviceGroups: ['Wealth Management', 'Brokerage', 'Venture Capital'],
  defaultThemes: [...INV_T],
  defaultLayouts: [...INV_L],
  services: INVESTMENT_SERVICES_SERVICES,
}

export const INSURANCE_SERVICES_INDUSTRY: IndustryDef = {
  slug: 'insurance-services', label: 'Insurance Services',
  keywords: ['insurance underwriting', 'insurance brokerage', 'claims adjusting', 'insurance agent'],
  serviceGroups: ['Underwriting', 'Brokerage', 'Claims'],
  defaultThemes: [...INS_T],
  defaultLayouts: [...INS_L],
  services: INSURANCE_SERVICES_SERVICES,
}

export const REAL_ESTATE_SERVICES_INDUSTRY: IndustryDef = {
  slug: 'real-estate-services', label: 'Real Estate Services',
  keywords: ['property management', 'real estate brokerage', 'realtor', 'property appraisal'],
  serviceGroups: ['Management', 'Brokerage', 'Appraisal'],
  defaultThemes: [...RE_T],
  defaultLayouts: [...RE_L],
  services: REAL_ESTATE_SERVICES_SERVICES,
}
