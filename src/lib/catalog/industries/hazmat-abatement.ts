import type { IndustryDef, ServiceDef } from '@/lib/catalog/types'

const IMG = 'https://images.unsplash.com/photo-1581094794329-c8112a89af12'

function svc(label: string, group: string, themes: ServiceDef['recommendedThemes'], layouts: ServiceDef['recommendedLayouts'], catalog: ServiceDef['catalog'], keywords: string[] = []): ServiceDef {
  return { label, group, industry: 'hazmat-abatement', keywords, widgetCategory: label, recommendedThemes: themes, recommendedLayouts: layouts, catalog }
}

const T = ['home-guardian', 'commercial-pro', 'functional-utility', 'modern-office'] as const
const L = ['trust-report', 'process-steps', 'trust-builder', 'emergency-first'] as const

export const HAZMAT_ABATEMENT_SERVICES: ServiceDef[] = [
  svc('Asbestos Testing & Inspection', 'Testing', [...T], [...L], { image: IMG, description: 'Sampling and accredited lab analysis before any demolition starts.' }, ['asbestos testing', 'asbestos testers', 'asbestos inspection', 'asbestos survey']),
  svc('Asbestos Abatement', 'Asbestos', [...T], [...L], { image: IMG, description: 'Licensed removal under containment, with air clearance at the end.' }, ['asbestos removal', 'asbestos abatement', 'asbestos removal contractors', 'asbestos remediation']),
  svc('Popcorn Ceiling & Floor Tile Abatement', 'Asbestos', [...T], [...L], { image: IMG, description: 'Asbestos-containing ceilings, tile, and mastic removed and disposed.' }, ['popcorn ceiling removal', 'asbestos tile removal', 'mastic removal', 'asbestos floor tile']),
  svc('Lead Paint Testing', 'Testing', [...T], [...L], { image: IMG, description: 'XRF and sampling surveys for pre-1978 homes and rentals.' }, ['lead testing', 'lead paint testing', 'lead inspection', 'lead risk assessment']),
  svc('Lead Paint Abatement', 'Lead', [...T], [...L], { image: IMG, description: 'RRP-certified removal, encapsulation, and component replacement.' }, ['lead removal', 'lead abatement', 'lead paint removal', 'lead remediation']),
  svc('Radon Testing & Mitigation', 'Mitigation', [...T], [...L], { image: IMG, description: 'Continuous monitor testing and sub-slab depressurisation systems.' }, ['radon testing', 'radon mitigation', 'radon inspectors', 'radon system']),
  svc('Vermiculite & Insulation Removal', 'Asbestos', [...T], [...L], { image: IMG, description: 'Vermiculite attic insulation removed under containment.' }, ['vermiculite removal', 'attic insulation abatement', 'vermiculite insulation']),
  svc('Hazardous Material Disposal', 'Mitigation', [...T], [...L], { image: IMG, description: 'Manifested transport and disposal of regulated waste.' }, ['hazardous waste disposal', 'hazmat disposal', 'regulated waste removal']),
]

export const HAZMAT_ABATEMENT_INDUSTRY: IndustryDef = {
  slug: 'hazmat-abatement', label: 'Asbestos & Hazardous Material Abatement',
  keywords: ['asbestos', 'asbestos removal', 'asbestos abatement', 'lead paint removal', 'lead abatement', 'hazardous material', 'radon mitigation', 'environmental abatement'],
  serviceGroups: ['Asbestos', 'Lead', 'Testing', 'Mitigation'],
  defaultThemes: [...T],
  defaultLayouts: [...L],
  services: HAZMAT_ABATEMENT_SERVICES,
}
