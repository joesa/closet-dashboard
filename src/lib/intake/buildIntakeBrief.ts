import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'

/** Plain-text brief for Gemini generate-site from prospect intake fields. */
export function buildIntakeBrief(row: ProspectIntakeRow): string {
  const lines: string[] = []
  const add = (label: string, value: string | null | undefined) => {
    if (value?.trim()) lines.push(`${label}: ${value.trim()}`)
  }

  add('Business name', row.business_name)
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
  if (row.differentiators?.length) {
    lines.push(`Differentiators: ${row.differentiators.join(', ')}`)
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
