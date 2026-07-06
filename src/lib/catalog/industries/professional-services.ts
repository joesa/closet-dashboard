import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1497366216548-37526070297c'
const OFFICE_IMG = 'https://images.unsplash.com/photo-1524758631624-e2822e304c36'

function pr(
  label: string,
  group: string,
  industry: 'legal-services' | 'financial-professionals' | 'business-consulting' | 'marketing-advertising' | 'it-services' | 'architecture-engineering' | 'research-services',
  themes: ServiceDef['recommendedThemes'],
  layouts: ServiceDef['recommendedLayouts'],
  catalog: ServiceDef['catalog'],
  keywords: string[] = []
): ServiceDef {
  return { label, group, industry, keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const LEGAL_T = ['office-executive', 'commercial-pro', 'historic-classic', 'luxury-minimal'] as const
const LEGAL_L = ['trust-builder', 'trust-report', 'standard', 'conversion-focus'] as const

export const LEGAL_SERVICES_SERVICES: ServiceDef[] = [
  pr('Law Firm Consultation', 'Legal', 'legal-services', [...LEGAL_T], [...LEGAL_L], { image: IMG, description: 'Experienced attorneys handling your case with a free initial consultation.' }, ['law firm', 'attorney', 'lawyer consultation', 'legal representation']),
  pr('Public Notary Service', 'Legal', 'legal-services', ['office-executive', 'commercial-pro', 'swift-mobile', 'modern-office'], ['compact-quote', 'trust-builder', 'service-zones', 'standard'], { image: IMG, description: 'Certified public notary services for contracts, affidavits, and documents.' }, ['public notary', 'notarize document', 'notary services']),
  pr('Bail Bonds', 'Legal', 'legal-services', ['office-executive', 'brutalist', 'commercial-pro', 'functional-utility'], ['emergency-first', 'compact-quote', 'trust-builder', 'standard'], { image: IMG, description: '24/7 bail bond service to get your loved one released quickly.' }, ['bail bonds', 'bail bondsman', 'bond service', 'jail release']),
  pr('Legal Consulting', 'Legal', 'legal-services', ['office-executive', 'commercial-pro', 'historic-classic', 'modern-office'], ['trust-builder', 'storyteller', 'trust-report', 'conversion-focus'], { image: IMG, description: 'Business and compliance legal consulting for growing companies.' }, ['legal consulting', 'business legal advice', 'compliance consulting']),
]

const FIN_T = ['commercial-pro', 'office-executive', 'modern-office', 'luxury-minimal'] as const
const FIN_L = ['trust-builder', 'trust-report', 'conversion-focus', 'standard'] as const

export const FINANCIAL_PROFESSIONALS_SERVICES: ServiceDef[] = [
  pr('Accounting Services', 'Accounting', 'financial-professionals', [...FIN_T], [...FIN_L], { image: IMG, description: 'Full-charge accounting, financial statements, and monthly reconciliation.' }, ['accounting', 'accountant', 'financial statements', 'accounting firm']),
  pr('Auditing Services', 'Auditing', 'financial-professionals', ['commercial-pro', 'office-executive', 'modern-office', 'functional-utility'], ['trust-report', 'trust-builder', 'standard', 'conversion-focus'], { image: IMG, description: 'Independent financial audits for compliance and investor confidence.' }, ['auditing', 'financial audit', 'compliance audit', 'audit firm']),
  pr('Bookkeeping Services', 'Bookkeeping', 'financial-professionals', ['modern-office', 'commercial-pro', 'functional-utility', 'minimalist-zen'], ['compact-quote', 'trust-builder', 'process-steps', 'standard'], { image: IMG, description: 'Monthly bookkeeping, payroll, and expense tracking for small businesses.' }, ['bookkeeping', 'bookkeeper', 'small business books', 'payroll service']),
  pr('Tax Preparation', 'Tax', 'financial-professionals', ['commercial-pro', 'modern-office', 'office-executive', 'classic-warm'], ['conversion-focus', 'trust-builder', 'compact-quote', 'seasonal-cta'], { image: IMG, description: 'Individual and business tax preparation with maximum refund guarantee.' }, ['tax preparation', 'tax preparer', 'income tax filing', 'tax accountant']),
]

const CONS_T = ['office-executive', 'commercial-pro', 'modern-office', 'minimalist-zen'] as const
const CONS_L = ['storyteller', 'trust-builder', 'conversion-focus', 'standard'] as const

export const BUSINESS_CONSULTING_SERVICES: ServiceDef[] = [
  pr('Business Strategy Consulting', 'Strategy', 'business-consulting', [...CONS_T], [...CONS_L], { image: OFFICE_IMG, description: 'Strategic planning and growth consulting for founders and executives.' }, ['business consulting', 'strategy consulting', 'management consulting', 'growth strategy']),
  pr('HR Consulting', 'HR', 'business-consulting', ['office-executive', 'commercial-pro', 'care-comfort', 'modern-office'], ['trust-builder', 'process-steps', 'storyteller', 'standard'], { image: OFFICE_IMG, description: 'HR policy, hiring, and compliance consulting for growing teams.' }, ['hr consulting', 'human resources consulting', 'hr compliance', 'hiring consulting']),
  pr('Public Relations', 'PR', 'business-consulting', ['media-creative', 'office-executive', 'commercial-pro', 'modern-office'], ['storyteller', 'portfolio-first', 'trust-builder', 'conversion-focus'], { image: OFFICE_IMG, description: 'Media relations, press outreach, and brand reputation management.' }, ['public relations', 'pr agency', 'media relations', 'press outreach']),
]

const MKT_T = ['media-creative', 'modern-office', 'brutalist', 'commercial-pro'] as const
const MKT_L = ['portfolio-first', 'gallery-showcase', 'conversion-focus', 'visual-impact'] as const

export const MARKETING_ADVERTISING_SERVICES: ServiceDef[] = [
  pr('Media Buying & Ad Campaigns', 'Advertising', 'marketing-advertising', [...MKT_T], [...MKT_L], { image: OFFICE_IMG, description: 'Paid media planning and buying across search, social, and display.' }, ['media buying', 'ad campaign', 'paid advertising', 'ppc management']),
  pr('SEO Auditing & Strategy', 'SEO', 'marketing-advertising', ['modern-office', 'media-creative', 'commercial-pro', 'minimalist-zen'], ['trust-report', 'conversion-focus', 'process-steps', 'standard'], { image: OFFICE_IMG, description: 'Technical SEO audits and content strategy to grow organic traffic.' }, ['seo audit', 'seo agency', 'search engine optimization', 'seo strategy']),
  pr('Copywriting Services', 'Copywriting', 'marketing-advertising', ['media-creative', 'cozy-library', 'modern-office', 'minimalist-zen'], ['portfolio-first', 'storyteller', 'gallery-showcase', 'standard'], { image: OFFICE_IMG, description: 'Website, ad, and email copy that converts, written by pro copywriters.' }, ['copywriting', 'copywriter', 'website copy', 'ad copy']),
  pr('Graphic Design', 'Design', 'marketing-advertising', ['media-creative', 'creative-craft', 'brutalist', 'luxury-gallery'], ['portfolio-first', 'gallery-showcase', 'visual-impact', 'standard'], { image: OFFICE_IMG, description: 'Brand identity, logos, and marketing collateral design.' }, ['graphic design', 'logo design', 'brand design', 'graphic designer']),
]

const IT_T = ['modern-office', 'commercial-pro', 'office-executive', 'minimalist-zen'] as const
const IT_L = ['trust-builder', 'conversion-focus', 'standard', 'trust-report'] as const

export const IT_SERVICES_SERVICES: ServiceDef[] = [
  pr('Custom Software Development', 'Development', 'it-services', [...IT_T], [...IT_L], { image: OFFICE_IMG, description: 'Custom web, mobile, and internal software built for your business.' }, ['software development', 'custom software', 'app development', 'software agency']),
  pr('Cybersecurity Services', 'Security', 'it-services', ['modern-office', 'brutalist', 'commercial-pro', 'office-executive'], ['trust-report', 'trust-builder', 'conversion-focus', 'standard'], { image: OFFICE_IMG, description: 'Security audits, penetration testing, and managed threat monitoring.' }, ['cybersecurity services', 'penetration testing', 'security audit', 'threat monitoring']),
  pr('Cloud Hosting & Infrastructure', 'Cloud', 'it-services', ['modern-office', 'commercial-pro', 'minimalist-zen', 'functional-utility'], ['trust-builder', 'standard', 'conversion-focus', 'compact-quote'], { image: OFFICE_IMG, description: 'Cloud migration, hosting, and infrastructure management services.' }, ['cloud hosting', 'cloud migration', 'server management', 'infrastructure services']),
  pr('IT Helpdesk & Managed Services', 'Support', 'it-services', ['modern-office', 'commercial-pro', 'office-executive', 'functional-utility'], ['emergency-first', 'trust-builder', 'compact-quote', 'standard'], { image: OFFICE_IMG, description: 'Managed IT support and helpdesk for small and mid-size businesses.' }, ['it helpdesk', 'managed services provider', 'it support company', 'msp']),
]

const ARCH_T = ['office-executive', 'luxury-gallery', 'modern-office', 'minimalist-zen'] as const
const ARCH_L = ['portfolio-first', 'gallery-showcase', 'trust-builder', 'conversion-focus'] as const

export const ARCHITECTURE_ENGINEERING_SERVICES: ServiceDef[] = [
  pr('Structural Engineering', 'Engineering', 'architecture-engineering', [...ARCH_T], [...ARCH_L], { image: OFFICE_IMG, description: 'Structural design and engineering review for new builds and renovations.' }, ['structural engineering', 'structural engineer', 'engineering firm', 'structural design']),
  pr('Interior Design', 'Design', 'architecture-engineering', ['luxury-gallery', 'elegant-dressing', 'luxury-minimal', 'modern-office'], ['gallery-showcase', 'portfolio-first', 'storyteller', 'before-after'], { image: OFFICE_IMG, description: 'Residential and commercial interior design from concept to installation.' }, ['interior design', 'interior designer', 'space planning', 'design firm']),
  pr('Drafting & CAD Services', 'Drafting', 'architecture-engineering', ['modern-office', 'functional-utility', 'office-executive', 'minimalist-zen'], ['trust-report', 'process-steps', 'trust-builder', 'standard'], { image: OFFICE_IMG, description: 'Architectural drafting, CAD drawings, and permit-ready plan sets.' }, ['drafting services', 'cad drawings', 'architectural drafting', 'blueprint drafting']),
]

const RES_T = ['modern-office', 'commercial-pro', 'minimalist-zen', 'office-executive'] as const
const RES_L = ['trust-report', 'trust-builder', 'standard', 'conversion-focus'] as const

export const RESEARCH_SERVICES_SERVICES: ServiceDef[] = [
  pr('Scientific Testing & Lab Services', 'Testing', 'research-services', [...RES_T], [...RES_L], { image: OFFICE_IMG, description: 'Accredited lab testing and scientific analysis for industry and research.' }, ['scientific testing', 'lab testing', 'testing services', 'analytical lab']),
  pr('Market Research', 'Research', 'research-services', ['modern-office', 'commercial-pro', 'media-creative', 'office-executive'], ['trust-report', 'storyteller', 'trust-builder', 'standard'], { image: OFFICE_IMG, description: 'Market research studies, surveys, and competitive analysis.' }, ['market research', 'market research firm', 'consumer research', 'competitive analysis']),
  pr('Polling & Surveys', 'Polling', 'research-services', ['modern-office', 'commercial-pro', 'minimalist-zen', 'functional-utility'], ['trust-report', 'compact-quote', 'standard', 'trust-builder'], { image: OFFICE_IMG, description: 'Public opinion polling and survey design, fielding, and analysis.' }, ['polling', 'survey research', 'opinion polling', 'polling firm']),
]

export const LEGAL_SERVICES_INDUSTRY: IndustryDef = {
  slug: 'legal-services', label: 'Legal Services',
  keywords: ['law firm', 'attorney', 'lawyer', 'public notary', 'bail bonds', 'legal consulting'],
  serviceGroups: ['Legal'],
  defaultThemes: [...LEGAL_T],
  defaultLayouts: [...LEGAL_L],
  services: LEGAL_SERVICES_SERVICES,
}

export const FINANCIAL_PROFESSIONALS_INDUSTRY: IndustryDef = {
  slug: 'financial-professionals', label: 'Financial Professionals',
  keywords: ['accounting', 'accountant', 'auditing', 'bookkeeping', 'tax preparation', 'cpa firm'],
  serviceGroups: ['Accounting', 'Auditing', 'Bookkeeping', 'Tax'],
  defaultThemes: [...FIN_T],
  defaultLayouts: [...FIN_L],
  services: FINANCIAL_PROFESSIONALS_SERVICES,
}

export const BUSINESS_CONSULTING_INDUSTRY: IndustryDef = {
  slug: 'business-consulting', label: 'Management & Business Consulting',
  keywords: ['business consulting', 'management consulting', 'hr consulting', 'public relations', 'strategy consulting'],
  serviceGroups: ['Strategy', 'HR', 'PR'],
  defaultThemes: [...CONS_T],
  defaultLayouts: [...CONS_L],
  services: BUSINESS_CONSULTING_SERVICES,
}

export const MARKETING_ADVERTISING_INDUSTRY: IndustryDef = {
  slug: 'marketing-advertising', label: 'Marketing & Advertising',
  keywords: ['marketing agency', 'advertising agency', 'seo agency', 'copywriting', 'graphic design', 'media buying'],
  serviceGroups: ['Advertising', 'SEO', 'Copywriting', 'Design'],
  defaultThemes: [...MKT_T],
  defaultLayouts: [...MKT_L],
  services: MARKETING_ADVERTISING_SERVICES,
}

export const IT_SERVICES_INDUSTRY: IndustryDef = {
  slug: 'it-services', label: 'Information Technology Services',
  keywords: ['software development', 'cloud hosting', 'it helpdesk', 'managed services provider', 'it services company'],
  serviceGroups: ['Development', 'Security', 'Cloud', 'Support'],
  defaultThemes: [...IT_T],
  defaultLayouts: [...IT_L],
  services: IT_SERVICES_SERVICES,
}

export const ARCHITECTURE_ENGINEERING_INDUSTRY: IndustryDef = {
  slug: 'architecture-engineering', label: 'Architecture & Engineering',
  keywords: ['structural engineering', 'interior design', 'drafting services', 'architecture firm', 'engineering firm'],
  serviceGroups: ['Engineering', 'Design', 'Drafting'],
  defaultThemes: [...ARCH_T],
  defaultLayouts: [...ARCH_L],
  services: ARCHITECTURE_ENGINEERING_SERVICES,
}

export const RESEARCH_SERVICES_INDUSTRY: IndustryDef = {
  slug: 'research-services', label: 'Research & Development Services',
  keywords: ['scientific testing', 'market research', 'polling', 'research firm', 'lab testing'],
  serviceGroups: ['Testing', 'Research', 'Polling'],
  defaultThemes: [...RES_T],
  defaultLayouts: [...RES_L],
  services: RESEARCH_SERVICES_SERVICES,
}
