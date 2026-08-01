import { analyzeSpecificity } from '@/lib/validation/specificityGate'

export type GeneratedContentProfile = 'label' | 'prose'

export type GeneratedContentUnit = {
  id: string
  text: string
  sourceText?: string | null
}

export type GeneratedContentFinding = {
  stage: string
  unitId: string
  code: string
  message: string
  samples: string[]
}

export type GeneratedContentQualityReport = {
  status: 'passed' | 'failed'
  findings: GeneratedContentFinding[]
  failedUnitIds: string[]
}

const SPEC_CTA_RE = /\b(?:view|read|open)\s+(?:protocol|dossier|case file)\b/gi

export function validateGeneratedUnits(input: {
  stage: string
  units: GeneratedContentUnit[]
  profile?: GeneratedContentProfile
  businessName?: string | null
  locality?: string | null
}): GeneratedContentQualityReport {
  const findings: GeneratedContentFinding[] = []
  const profile = input.profile ?? 'prose'

  for (const unit of input.units) {
    const specificity = analyzeSpecificity({
      text: unit.text,
      sourceText: unit.sourceText,
      businessName: input.businessName,
      locality: input.locality,
    }).filter((finding) => profile === 'prose' || finding.code === 'copy_ai_tell_phrase')

    for (const finding of specificity) {
      findings.push({
        stage: input.stage,
        unitId: unit.id,
        code: finding.code,
        message: finding.message,
        samples: finding.samples,
      })
    }

    const specCtas = unit.text.match(SPEC_CTA_RE) ?? []
    if (specCtas.length > 0) {
      findings.push({
        stage: input.stage,
        unitId: unit.id,
        code: 'spec_sheet_cta',
        message: 'Replace document-style labels with a natural customer action.',
        samples: Array.from(new Set(specCtas.map((sample) => sample.trim()))),
      })
    }
  }

  const failedUnitIds = Array.from(new Set(findings.map((finding) => finding.unitId)))
  return {
    status: findings.length > 0 ? 'failed' : 'passed',
    findings,
    failedUnitIds,
  }
}