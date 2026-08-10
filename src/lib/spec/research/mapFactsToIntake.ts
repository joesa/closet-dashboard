import { cityFromAddress } from '@/lib/spec/qualifyLead'
import { CRAFT_FACT_FIELDS } from '@/lib/spec/research/verifyFacts'
import { findProprietaryDetail } from '@/lib/validation/specificityGate'
import type { SpecBuildLeadInput, SpecFact } from '@/lib/spec/types'

/**
 * Turn a lead plus its verified facts into the `prospect_intakes` columns a
 * prospect would have filled in by hand.
 *
 * Two rules shape everything here:
 *
 *  1. Only verified facts may fill a column. `verifyFacts` has already dropped
 *     anything unevidenced, so this function's job is placement, not judgement.
 *
 *  2. Columns with no source stay NULL. In particular `vibe`, `tone`,
 *     `customers`, `experience`, `differentiators` and `primary_cta` are taste
 *     and self-description — a cold lead has told us none of it, and inventing
 *     it is how a site starts describing a business that does not exist. An
 *     empty column produces plainer copy; a guessed one produces a lie.
 */

export type IntakePatch = Record<string, unknown>

/**
 * Stand-ins rendered on a spec site in place of the owner's real contact
 * details. Written as sentences rather than blanks so the business reads them
 * as a deliberate state — "this switches on when you approve" — instead of a
 * mistake we made.
 */
export const SPEC_PHONE_PLACEHOLDER = 'Your phone number appears here once you approve'
export const SPEC_EMAIL_PLACEHOLDER = 'Your email appears here once you approve'

export type MapFactsResult = {
  patch: IntakePatch
  /** Facts that had nowhere to go, for the admin ledger. */
  unused: SpecFact[]
}

/** Several facts can target one column; joined rather than fighting over it. */
const MULTI_VALUE_FIELDS = new Set(['customer_quotes', 'notes', 'signature_materials'])

const MAX_QUOTES = 4
const MAX_NOTE_CHARS = 1200

export function mapFactsToIntake(
  lead: SpecBuildLeadInput,
  facts: SpecFact[],
  opts: { placeholderEmail: string }
): MapFactsResult {
  const patch: IntakePatch = {}
  const unused: SpecFact[] = []

  // ── Columns that come straight from the lead, not from research ──
  patch.business_name = lead.businessName
  patch.industry = lead.businessCategory?.trim() || null
  patch.services = lead.services ?? []
  // The business's real number never reaches the generated site.
  //
  // Two reasons. A spec site that publishes a working phone number is a lead
  // funnel for a business that has not agreed to have one, and if a customer
  // ever found it they would be calling about a site the owner does not know
  // exists. And when the owner reviews the site, a visible placeholder is what
  // tells them the number is theirs to switch on by approving — far clearer
  // than seeing their real number and wondering whether it is already live.
  //
  // adoptSpecBuild restores the real number at acceptance. The lead record
  // keeps it throughout; this only governs what the site renders.
  patch.contact_phone = SPEC_PHONE_PLACEHOLDER
  patch.notification_phone = SPEC_PHONE_PLACEHOLDER

  // Never the owner's real address for contact — a spec build must not create
  // an account or send mail to someone who has not agreed to anything.
  patch.contact_email = opts.placeholderEmail
  patch.notification_email = opts.placeholderEmail

  const city = lead.city?.trim() || cityFromAddress(lead.address)
  if (city) {
    patch.address_locality = city
    patch.service_area = city
  }
  if (lead.address?.trim()) patch.street_address = lead.address.trim()

  patch.intake_tier = 'ai_premium'
  patch.deposit_required_cents = 0
  patch.deposit_status = 'waived'
  patch.source = 'spec'
  patch.requested_product = 'full'

  // ── Columns filled only by verified facts ──
  const grouped = new Map<string, SpecFact[]>()
  for (const fact of facts) {
    const list = grouped.get(fact.field) ?? []
    list.push(fact)
    grouped.set(fact.field, list)
  }

  for (const [field, group] of grouped) {
    if (field === 'business_name' || field === 'industry' || field === 'service_area') {
      // Lead data already covers these and is more reliable than a page scrape.
      unused.push(...group)
      continue
    }

    if (field === 'customer_quotes') {
      // Quotes are already guaranteed verbatim and review-sourced by
      // verifyFacts, which is what legitimately unlocks a testimonials page.
      const quotes = group.slice(0, MAX_QUOTES).map((f) => `"${f.value.trim()}"`)
      unused.push(...group.slice(MAX_QUOTES))
      if (quotes.length > 0) patch.customer_quotes = quotes.join('\n')
      continue
    }

    if (field === 'signature_materials') {
      const materials = group.flatMap((f) =>
        f.value
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean)
      )
      if (materials.length > 0) patch.signature_materials = dedupe(materials)
      continue
    }

    if (field === 'notes') {
      const joined = group.map((f) => f.value.trim()).join('\n\n')
      patch.notes = joined.slice(0, MAX_NOTE_CHARS)
      continue
    }

    if ((CRAFT_FACT_FIELDS as readonly string[]).includes(field)) {
      // One column, one fact — the brief renders these as single statements.
      // Extra candidates are surfaced rather than concatenated into mush.
      patch[field] = group[0].value.trim()
      unused.push(...group.slice(1))
      continue
    }

    if (!MULTI_VALUE_FIELDS.has(field)) unused.push(...group)
  }

  return { patch, unused }
}

/** Everything on the intake that can carry a concrete claim into the brief. */
export function proprietaryText(patch: IntakePatch): string {
  const parts: string[] = []
  for (const field of CRAFT_FACT_FIELDS) {
    const value = patch[field]
    if (typeof value === 'string' && value.trim()) parts.push(value.trim())
    else if (Array.isArray(value)) parts.push(value.filter((v) => typeof v === 'string').join(', '))
  }
  if (typeof patch.customer_quotes === 'string') parts.push(patch.customer_quotes)
  return parts.join('\n')
}

/**
 * True when the intake carries a claim that would actually survive the copy gate.
 *
 * This asks the same question `analyzeSpecificity` asks — is there a measurement
 * or a named thing? — rather than merely "is a column non-empty". The
 * distinction is expensive: a fact like "The owner himself" fills a column but
 * earns no credit, so checking for presence would release a build to be paid
 * for and then fail `copy_no_proprietary_detail` at the very end, which is the
 * one finding no machine can repair.
 */
export function hasProprietaryDetail(
  patch: IntakePatch,
  own: { businessName?: string | null; locality?: string | null } = {}
): boolean {
  const text = proprietaryText(patch)
  if (!text.trim()) return false
  const { measurements, properNouns } = findProprietaryDetail(text, {
    businessName: own.businessName ?? (patch.business_name as string | undefined),
    locality: own.locality ?? (patch.address_locality as string | undefined),
  })
  return measurements.length > 0 || properNouns.length > 0
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>()
  return values.filter((v) => {
    const key = v.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
