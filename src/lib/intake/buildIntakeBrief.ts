import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'

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
  add('Email', row.contact_email)

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
