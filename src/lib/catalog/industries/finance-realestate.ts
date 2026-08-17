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
  fi('Personal & Auto Loans', 'Lending', 'banking-lending', ['commercial-pro', 'office-executive', 'luxury-minimal', 'modern-office'], ['trust-builder', 'trust-report', 'conversion-focus', 'standard'], { image: IMG, description: 'Instalment and vehicle loans with local underwriting.' }, ['personal loan', 'auto loan', 'car loan', 'installment loan']),
  fi('Small Business & SBA Lending', 'Lending', 'banking-lending', ['commercial-pro', 'office-executive', 'luxury-minimal', 'modern-office'], ['trust-builder', 'trust-report', 'conversion-focus', 'standard'], { image: IMG, description: 'SBA and conventional business loans and lines of credit.' }, ['business loan', 'sba loan', 'line of credit', 'small business lending']),
  fi('Refinancing & Home Equity', 'Mortgage', 'banking-lending', ['commercial-pro', 'office-executive', 'luxury-minimal', 'modern-office'], ['trust-builder', 'trust-report', 'conversion-focus', 'standard'], { image: IMG, description: 'Refinances, HELOCs, and home equity loans.' }, ['refinance', 'home equity loan', 'heloc', 'mortgage refinance']),
  fi('Business Banking & Merchant Services', 'Banking', 'banking-lending', ['commercial-pro', 'office-executive', 'luxury-minimal', 'modern-office'], ['trust-builder', 'trust-report', 'conversion-focus', 'standard'], { image: IMG, description: 'Operating accounts, card processing, and treasury basics.' }, ['business banking', 'merchant services', 'card processing', 'business account']),
]

const INV_T = ['office-executive', 'luxury-minimal', 'commercial-pro', 'historic-classic'] as const
const INV_L = ['trust-builder', 'trust-report', 'storyteller', 'conversion-focus'] as const

export const INVESTMENT_SERVICES_SERVICES: ServiceDef[] = [
  fi('Wealth Management', 'Wealth Management', 'investment-services', [...INV_T], [...INV_L], { image: IMG, description: 'Personalized wealth management and financial planning for individuals.' }, ['wealth management', 'financial planner', 'wealth advisor', 'financial advisory']),
  fi('Stock Brokerage', 'Brokerage', 'investment-services', ['office-executive', 'commercial-pro', 'modern-office', 'luxury-minimal'], ['trust-builder', 'conversion-focus', 'trust-report', 'standard'], { image: IMG, description: 'Full-service and self-directed stock brokerage accounts.' }, ['stock brokerage', 'brokerage firm', 'investment account', 'trading account']),
  fi('Venture Capital & Private Equity', 'Venture Capital', 'investment-services', ['office-executive', 'luxury-minimal', 'historic-classic', 'commercial-pro'], ['storyteller', 'trust-builder', 'portfolio-first', 'standard'], { image: IMG, description: 'Venture capital and private equity investment for growth-stage companies.' }, ['venture capital', 'private equity', 'vc firm', 'growth capital']),
  fi('Retirement & 401(k) Planning', 'Wealth Management', 'investment-services', ['modern-office', 'office-executive', 'commercial-pro', 'minimalist-zen'], ['trust-report', 'trust-builder', 'process-steps', 'conversion-focus'], { image: IMG, description: 'Rollovers, contribution strategy, and drawdown planning.' }, ['retirement planning', '401k rollover', 'ira planning', 'retirement advisor']),
  fi('Estate & Trust Planning', 'Wealth Management', 'investment-services', ['modern-office', 'office-executive', 'commercial-pro', 'minimalist-zen'], ['trust-report', 'trust-builder', 'process-steps', 'conversion-focus'], { image: IMG, description: 'Beneficiary structure and trust coordination with your attorney.' }, ['estate planning', 'trust planning', 'inheritance planning']),
  fi('College Savings Planning', 'Wealth Management', 'investment-services', ['modern-office', 'office-executive', 'commercial-pro', 'minimalist-zen'], ['trust-report', 'trust-builder', 'process-steps', 'conversion-focus'], { image: IMG, description: '529 plans and education funding schedules by target year.' }, ['college savings', '529 plan', 'education savings']),
  fi('Financial Planning Consultation', 'Brokerage', 'investment-services', ['modern-office', 'office-executive', 'commercial-pro', 'minimalist-zen'], ['trust-report', 'trust-builder', 'process-steps', 'conversion-focus'], { image: IMG, description: 'A written plan covering cash flow, insurance, and investments.' }, ['financial planning', 'financial advisor', 'fee only planner', 'cfp']),
  fi('Business Succession Planning', 'Venture Capital', 'investment-services', ['modern-office', 'office-executive', 'commercial-pro', 'minimalist-zen'], ['trust-report', 'trust-builder', 'process-steps', 'conversion-focus'], { image: IMG, description: 'Valuation, buy-sell agreements, and an exit timeline for owners.' }, ['succession planning', 'business exit planning', 'buy sell agreement']),
]

const INS_T = ['commercial-pro', 'modern-office', 'office-executive', 'functional-utility'] as const
const INS_L = ['trust-builder', 'trust-report', 'compact-quote', 'conversion-focus'] as const

export const INSURANCE_SERVICES_SERVICES: ServiceDef[] = [
  fi('Insurance Underwriting', 'Underwriting', 'insurance-services', [...INS_T], [...INS_L], { image: IMG, description: 'Risk assessment and policy underwriting for individuals and businesses.' }, ['insurance underwriting', 'underwriter', 'policy underwriting']),
  fi('Insurance Brokerage', 'Brokerage', 'insurance-services', ['commercial-pro', 'office-executive', 'modern-office', 'classic-warm'], ['trust-builder', 'conversion-focus', 'trust-report', 'standard'], { image: IMG, description: 'Independent insurance brokerage comparing quotes across top carriers.' }, ['insurance broker', 'insurance brokerage', 'insurance agent', 'insurance quote']),
  fi('Claims Adjusting', 'Claims', 'insurance-services', ['commercial-pro', 'modern-office', 'functional-utility', 'office-executive'], ['trust-report', 'process-steps', 'compact-quote', 'standard'], { image: IMG, description: 'Independent claims adjusting and damage assessment services.' }, ['claims adjuster', 'claims adjusting', 'insurance claims', 'damage assessment']),
  fi('Auto & Home Insurance', 'Brokerage', 'insurance-services', ['modern-office', 'office-executive', 'commercial-pro', 'minimalist-zen'], ['trust-report', 'trust-builder', 'process-steps', 'conversion-focus'], { image: IMG, description: 'Personal auto, home, and umbrella policies quoted across carriers.' }, ['auto insurance', 'home insurance', 'homeowners insurance', 'car insurance quote']),
  fi('Commercial & Liability Insurance', 'Brokerage', 'insurance-services', ['modern-office', 'office-executive', 'commercial-pro', 'minimalist-zen'], ['trust-report', 'trust-builder', 'process-steps', 'conversion-focus'], { image: IMG, description: 'General liability, property, and workers compensation for small business.' }, ['commercial insurance', 'general liability insurance', 'business insurance', 'workers comp']),
  fi('Life & Disability Insurance', 'Underwriting', 'insurance-services', ['modern-office', 'office-executive', 'commercial-pro', 'minimalist-zen'], ['trust-report', 'trust-builder', 'process-steps', 'conversion-focus'], { image: IMG, description: 'Term, whole life, and disability coverage sized to your obligations.' }, ['life insurance', 'term life', 'disability insurance']),
  fi('Health & Medicare Plans', 'Brokerage', 'insurance-services', ['modern-office', 'office-executive', 'commercial-pro', 'minimalist-zen'], ['trust-report', 'trust-builder', 'process-steps', 'conversion-focus'], { image: IMG, description: 'Marketplace, group health, and Medicare supplement enrollment.' }, ['health insurance', 'medicare plans', 'medicare supplement', 'aca enrollment']),
  fi('Public Adjusting & Claim Support', 'Claims', 'insurance-services', ['modern-office', 'office-executive', 'commercial-pro', 'minimalist-zen'], ['trust-report', 'trust-builder', 'process-steps', 'conversion-focus'], { image: IMG, description: 'Documenting and negotiating a property claim on the policyholder\'s side.' }, ['public adjuster', 'insurance claim help', 'claim negotiation']),
]

const RE_T = ['luxury-gallery', 'luxury-minimal', 'commercial-pro', 'coastal-climate'] as const
const RE_L = ['gallery-showcase', 'portfolio-first', 'trust-builder', 'conversion-focus'] as const

export const REAL_ESTATE_SERVICES_SERVICES: ServiceDef[] = [
  fi('Property Management', 'Management', 'real-estate-services', ['commercial-pro', 'modern-office', 'functional-utility', 'luxury-minimal'], ['trust-builder', 'service-zones', 'trust-report', 'standard'], { image: IMG, description: 'Full-service property management for landlords and investors.' }, ['property management', 'property manager', 'rental management', 'landlord services']),
  fi('Real Estate Brokerage', 'Brokerage', 'real-estate-services', [...RE_T], [...RE_L], { image: IMG, description: 'Buying, selling, and listing representation from local real estate experts.' }, ['real estate brokerage', 'real estate agent', 'realtor', 'home buying']),
  fi('Property Appraisal', 'Appraisal', 'real-estate-services', ['commercial-pro', 'office-executive', 'luxury-minimal', 'functional-utility'], ['trust-report', 'compact-quote', 'trust-builder', 'standard'], { image: IMG, description: 'Certified residential and commercial property appraisals.' }, ['property appraisal', 'home appraisal', 'appraiser', 'real estate appraisal']),
  fi('Residential Sales Representation', 'Brokerage', 'real-estate-services', ['modern-office', 'office-executive', 'commercial-pro', 'minimalist-zen'], ['trust-report', 'trust-builder', 'process-steps', 'conversion-focus'], { image: IMG, description: 'Listing and buyer representation from pricing through closing.' }, ['realtor', 'real estate agent', 'listing agent', 'buyers agent', 'home sales']),
  fi('Commercial Leasing & Sales', 'Brokerage', 'real-estate-services', ['modern-office', 'office-executive', 'commercial-pro', 'minimalist-zen'], ['trust-report', 'trust-builder', 'process-steps', 'conversion-focus'], { image: IMG, description: 'Tenant and landlord representation for retail, office, and industrial space.' }, ['commercial real estate', 'commercial leasing', 'office space broker']),
  fi('Rental Listing & Tenant Placement', 'Management', 'real-estate-services', ['modern-office', 'office-executive', 'commercial-pro', 'minimalist-zen'], ['trust-report', 'trust-builder', 'process-steps', 'conversion-focus'], { image: IMG, description: 'Marketing, screening, and lease signing without full management.' }, ['tenant placement', 'rental listing', 'tenant screening', 'leasing service']),
  fi('HOA & Community Management', 'Management', 'real-estate-services', ['modern-office', 'office-executive', 'commercial-pro', 'minimalist-zen'], ['trust-report', 'trust-builder', 'process-steps', 'conversion-focus'], { image: IMG, description: 'Board support, dues collection, and vendor coordination for associations.' }, ['hoa management', 'community management', 'association management']),
  fi('Investment Property Analysis', 'Appraisal', 'real-estate-services', ['modern-office', 'office-executive', 'commercial-pro', 'minimalist-zen'], ['trust-report', 'trust-builder', 'process-steps', 'conversion-focus'], { image: IMG, description: 'Rent rolls, cap rates, and hold analysis before you buy.' }, ['investment property analysis', 'cap rate analysis', 'rental analysis']),
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
