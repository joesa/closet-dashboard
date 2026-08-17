import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'
import { CRAFT_COLUMN_BY_FIELD } from '@/lib/intake/buildIntakeBrief'

/**
 * The canonical record of what a business actually told us about itself.
 *
 * The intake is the only place un-inventable facts enter the platform, and
 * until now most of them never reached the thing that writes the site: the
 * craft columns became prose only inside `buildIntakeBrief`, which is reachable
 * only from AI-Premium-gated routes, and the Full redesign — which produces
 * every shipped site — reads `site_configs`, not the intake, through a
 * 900-character hint string.
 *
 * The ledger fixes the addressing problem: one artifact, built once, that every
 * generator can read. It is stored as JSONB on `prospect_intakes` rather than a
 * table because it is per-intake, always read whole, and never queried by field.
 *
 * Provenance is the part that matters. A fact a prospect typed and a sentence a
 * model suggested and they never edited are not the same kind of thing, and the
 * difference has to survive into the generator — otherwise the site states
 * invented specifics in the owner's voice, which is the exact failure the craft
 * questions exist to prevent.
 */

export type FactProvenance =
  /** The owner typed it, or edited an AI suggestion into their own words. */
  | 'owner_typed'
  /** AI suggested it, the owner changed it, and the edit is what we kept. */
  | 'ai_suggested_accepted'
  /** AI suggested it and the owner never touched it. NOT a fact about them. */
  | 'ai_suggested_unedited'
  /** Pulled from their existing web presence by the scraper / spec research. */
  | 'scraped'

export type LedgerFact = {
  /** Stable key — the intake column it came from. */
  key: string
  /** How the fact is introduced to the model. */
  label: string
  value: string
  provenance: FactProvenance
}

export type IntakeFactLedger = {
  version: number
  builtAt: string
  /** Identity and context: name, trade, service area, contact. */
  profile: LedgerFact[]
  /** What they sell. */
  services: { offered: string[]; other: string | null }
  /** The proprietary facts — the only sanctioned source of concrete claims. */
  facts: LedgerFact[]
  /** Verbatim owner-supplied quotes. Never paraphrased, never invented. */
  customerQuotes: string | null
}

export const FACT_LEDGER_VERSION = 1

/** Column → how the fact is introduced in the brief. Mirrors buildIntakeBrief. */
const FACT_LABELS: Array<[keyof ProspectIntakeRow, string]> = [
  ['craft_spec', 'What they measure, and to what tolerance'],
  ['shop_rule', 'Rule the shop never breaks'],
  ['local_conditions', 'What goes wrong on local jobs, and why'],
  ['crew_shape', 'Who does the work'],
  ['client_artifact', 'What the customer receives or reviews'],
  ['recent_job', 'A real recent job'],
  ['competitor_tell', 'What cheaper competitors get wrong'],
  ['timeline_facts', 'Real timeframes'],
  ['guarantee_terms', 'Guarantee, in the owner’s words'],
]

const PROFILE_LABELS: Array<[keyof ProspectIntakeRow, string]> = [
  ['business_name', 'Business name'],
  ['industry', 'Industry / trade'],
  ['service_area', 'Service area'],
  ['address_locality', 'City'],
  ['address_region', 'Region'],
  ['pricing_notes', 'Pricing notes'],
  ['customers', 'Ideal customers'],
  ['experience', 'Experience'],
]

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/**
 * Build the ledger from an intake row.
 *
 * `suggestedFields` is the client's list of craft fields still holding an
 * unedited AI suggestion (the same list `stripUneditedCraftSuggestions` acts
 * on). Pass it at submit time and those facts are recorded with
 * `ai_suggested_unedited` provenance instead of being silently dropped — the
 * value is kept so an admin can see what the model proposed, while
 * `renderFactsBrief` refuses to hand it to any generator.
 */
export function buildFactLedger(
  row: ProspectIntakeRow,
  opts: { suggestedFields?: unknown; scraped?: boolean } = {}
): IntakeFactLedger {
  const suggested = new Set(
    Array.isArray(opts.suggestedFields)
      ? opts.suggestedFields
          .filter((f): f is string => typeof f === 'string')
          .map((f) => CRAFT_COLUMN_BY_FIELD[f])
          .filter(Boolean)
      : []
  )
  const baseProvenance: FactProvenance = opts.scraped ? 'scraped' : 'owner_typed'

  const profile: LedgerFact[] = []
  for (const [column, label] of PROFILE_LABELS) {
    const value = text(row[column])
    if (value) profile.push({ key: String(column), label, value, provenance: baseProvenance })
  }

  const facts: LedgerFact[] = []
  for (const [column, label] of FACT_LABELS) {
    const value = text(row[column])
    if (!value) continue
    facts.push({
      key: String(column),
      label,
      value,
      provenance: suggested.has(String(column)) ? 'ai_suggested_unedited' : baseProvenance,
    })
  }
  if (row.signature_materials?.length) {
    facts.push({
      key: 'signature_materials',
      label: 'Named materials / brands / equipment',
      value: row.signature_materials.join(', '),
      provenance: suggested.has('signature_materials')
        ? 'ai_suggested_unedited'
        : baseProvenance,
    })
  }

  // "CUSTOM FACT — " lines in notes are owner-authored facts the wizard has no
  // dedicated field for. They have always fed the brief; keep them addressable.
  const noteLines = row.notes?.split('\n').map((l) => l.trim()).filter(Boolean) ?? []
  const customPrefix = 'CUSTOM FACT — '
  for (const line of noteLines) {
    if (!line.startsWith(customPrefix)) continue
    const value = line.slice(customPrefix.length).trim()
    if (value) facts.push({ key: 'custom_fact', label: 'Owner-supplied fact', value, provenance: 'owner_typed' })
  }

  return {
    version: FACT_LEDGER_VERSION,
    builtAt: new Date().toISOString(),
    profile,
    services: {
      offered: Array.isArray(row.services) ? row.services.filter(Boolean) : [],
      other: text(row.other_services),
    },
    facts,
    customerQuotes: text(row.customer_quotes),
  }
}

/** The facts a generator may state on the page. Excludes unedited suggestions. */
export function sanctionedFacts(ledger: IntakeFactLedger): LedgerFact[] {
  return ledger.facts.filter((f) => f.provenance !== 'ai_suggested_unedited')
}

/**
 * Render the ledger for a model.
 *
 * This is the FACTUAL channel. It must never be used as a creative seed and
 * must never reach `briefTextForScan` in the redesign — that string is what
 * makes design-guard checks brief-exempt, so a tile business whose facts
 * mention grout would stand down the grout-grid guard. Facts say what is true;
 * only an admin's seed says what the page should look like.
 */
export function renderFactsBrief(ledger: IntakeFactLedger | null): string {
  if (!ledger) return ''
  const lines: string[] = []

  for (const fact of ledger.profile) lines.push(`${fact.label}: ${fact.value}`)
  if (ledger.services.offered.length) {
    lines.push(`Services offered: ${ledger.services.offered.join(', ')}`)
  }
  if (ledger.services.other) lines.push(`Other / custom services: ${ledger.services.other}`)

  const facts = sanctionedFacts(ledger)
  if (facts.length) {
    lines.push('')
    lines.push('PROPRIETARY FACTS — the only sanctioned source of concrete claims.')
    lines.push(
      'Every statistic, process step, and proof point on the site must trace back to a line ' +
        'below. Do not round, embellish, or invent siblings for them. Where a section has no ' +
        'fact to stand on, make that section shorter rather than filling it with adjectives.'
    )
    for (const fact of facts) lines.push(`- ${fact.label}: ${fact.value}`)
  }

  if (ledger.customerQuotes) {
    lines.push('')
    lines.push('REAL CUSTOMER QUOTES (verbatim, owner-supplied). These are the ONLY quotes that')
    lines.push('may appear anywhere on the site. Never invent, extend, paraphrase into first')
    lines.push('person, or add attribution beyond what is written here.')
    lines.push(ledger.customerQuotes)
  }

  return lines.join('\n')
}

/** Parse a stored `fact_ledger` JSONB value, tolerating shape drift. */
export function parseFactLedger(raw: unknown): IntakeFactLedger | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Partial<IntakeFactLedger>
  if (!Array.isArray(value.facts) || !Array.isArray(value.profile)) return null
  return {
    version: typeof value.version === 'number' ? value.version : 0,
    builtAt: typeof value.builtAt === 'string' ? value.builtAt : '',
    profile: value.profile as LedgerFact[],
    services: {
      offered: Array.isArray(value.services?.offered) ? value.services!.offered : [],
      other: typeof value.services?.other === 'string' ? value.services!.other : null,
    },
    facts: value.facts as LedgerFact[],
    customerQuotes: typeof value.customerQuotes === 'string' ? value.customerQuotes : null,
  }
}
