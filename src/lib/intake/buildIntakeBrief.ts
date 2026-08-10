import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'
import { SPEC_EMAIL_PLACEHOLDER } from '@/lib/spec/research/mapFactsToIntake'

/**
 * True when the contractor supplied real customer quotes. This is the gate the
 * testimonials policy hangs off: no quotes, no testimonials page — never
 * fabricated ones.
 */
export function hasRealCustomerQuotes(row: Pick<ProspectIntakeRow, 'customer_quotes'>): boolean {
  return !!row.customer_quotes?.trim()
}

/** Client craft-field key → prospect_intakes column, for the suggestion policy below. */
const CRAFT_COLUMN_BY_FIELD: Record<string, string> = {
  craftSpec: 'craft_spec',
  clientArtifact: 'client_artifact',
  shopRule: 'shop_rule',
  localConditions: 'local_conditions',
  recentJob: 'recent_job',
  timelineFacts: 'timeline_facts',
  crewShape: 'crew_shape',
  competitorTell: 'competitor_tell',
  guaranteeTerms: 'guarantee_terms',
  signatureMaterials: 'signature_materials',
}

/**
 * Craft answers a prospect accepted verbatim from AI suggestions are examples,
 * not facts about their business. Blank those columns (in a row or an update
 * map) so invented specifics never enter the brief as "proprietary facts".
 */
export function stripUneditedCraftSuggestions(
  target: Record<string, unknown>,
  craftSuggestedFields: unknown
): void {
  if (!Array.isArray(craftSuggestedFields)) return
  for (const field of craftSuggestedFields) {
    const column = typeof field === 'string' ? CRAFT_COLUMN_BY_FIELD[field] : undefined
    if (!column) continue
    target[column] = column === 'signature_materials' ? [] : null
  }
}

/** Plain-text brief for Gemini generate-site from prospect intake fields. */
export function buildIntakeBrief(row: ProspectIntakeRow): string {
  const lines: string[] = []
  const add = (label: string, value: string | null | undefined) => {
    if (value?.trim()) lines.push(`${label}: ${value.trim()}`)
  }

  add('Business name', row.business_name)
  add('Industry / trade', row.industry)
  add('Service area', row.service_area)
  add('Vibe / look', row.vibe)
  add('Writing tone', row.tone)
  add('Ideal customers', row.customers)
  add('Experience', row.experience)
  add('Primary CTA', row.primary_cta)
  add('Pricing notes', row.pricing_notes)
  add('Additional notes', row.notes)

  if (row.services?.length) {
    lines.push(`Services offered: ${row.services.join(', ')}`)
  }
  if (row.other_services?.trim()) {
    lines.push(`Other / custom services: ${row.other_services.trim()}`)
  }
  if (row.differentiators?.length) {
    lines.push(`Differentiators: ${row.differentiators.join(', ')}`)
  }

  const facts: string[] = []
  const addFact = (label: string, value: string | null | undefined) => {
    if (value?.trim()) facts.push(`- ${label}: ${value.trim()}`)
  }

  addFact('What they measure, and to what tolerance', row.craft_spec)
  addFact('Rule the shop never breaks', row.shop_rule)
  addFact('What goes wrong on local jobs, and why', row.local_conditions)
  addFact('Who does the work', row.crew_shape)
  addFact('What the customer receives or reviews', row.client_artifact)
  addFact('A real recent job', row.recent_job)
  addFact('What cheaper competitors get wrong', row.competitor_tell)
  addFact('Real timeframes', row.timeline_facts)
  addFact('Guarantee, in the owner’s words', row.guarantee_terms)
  if (row.signature_materials?.length) {
    addFact('Named materials / brands / equipment', row.signature_materials.join(', '))
  }

  if (row.customer_quotes?.trim()) {
    lines.push('')
    lines.push('REAL CUSTOMER QUOTES (verbatim, owner-supplied). These are the ONLY quotes')
    lines.push('that may appear anywhere on the site. Never invent, extend, paraphrase into')
    lines.push('first person, or add attribution beyond what is written here.')
    lines.push(row.customer_quotes.trim())
  }

  if (facts.length) {
    lines.push('')
    lines.push('PROPRIETARY FACTS — the only sanctioned source of concrete claims.')
    lines.push(
      'Every statistic, process step, and proof point on the site must trace back to a line below. ' +
        'Do not round, embellish, or invent siblings for them. Where a section has no fact to stand on, ' +
        'make that section shorter rather than filling it with adjectives.'
    )
    lines.push(...facts)
  }

  add('Contact', row.contact_name)
  add('Phone', row.contact_phone)
  // A spec build's contact_email is a platform placeholder (spec+<id>@…) that
  // exists so provisioning has a unique owner address. It must never reach the
  // generated site: it leaked into a real footer, publishing an internal build
  // id, and it tells the business nothing. Swap in the sentence that explains
  // what will actually appear once they approve. adoptSpecBuild puts their real
  // address on the row at acceptance, after which this branch stops applying.
  add('Email', row.source === 'spec' ? SPEC_EMAIL_PLACEHOLDER : row.contact_email)

  const address = [
    row.street_address,
    row.address_locality,
    row.address_region,
    row.postal_code,
  ]
    .filter(Boolean)
    .join(', ')
  if (address) lines.push(`Address: ${address}`)

  return lines.join('\n')
}
