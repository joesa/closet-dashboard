import type { SpecFact, SpecFactSourceKind } from '@/lib/spec/types'

/**
 * The non-fabrication guarantee, enforced mechanically.
 *
 * A spec site carries a real business's name, phone and address to that
 * business's own owner. A single invented claim — a founding year, a crew
 * size, a guarantee they never offered — is both an embarrassment that kills
 * the sale and a false statement about a real company. So no claim is trusted
 * because a model produced it.
 *
 * Every extracted fact must carry `evidence`: a span copied character for
 * character out of the page text the extractor was shown. We then check that
 * the span really is in that page. A model that invents a fact cannot also
 * invent evidence that appears in a document it did not write, so this is a
 * proof rather than a plea in a prompt.
 *
 * Everything that fails is dropped silently and unconditionally. There is no
 * "probably fine" branch, because the cost of a wrong claim is much higher
 * than the cost of a thinner site.
 */

/** Columns that feed the brief's PROPRIETARY FACTS block. */
export const CRAFT_FACT_FIELDS = [
  'craft_spec',
  'shop_rule',
  'local_conditions',
  'crew_shape',
  'client_artifact',
  'recent_job',
  'competitor_tell',
  'timeline_facts',
  'guarantee_terms',
  'signature_materials',
] as const

/** Every column a fact is allowed to land in. Anything else is dropped. */
export const ALLOWED_FACT_FIELDS = [
  ...CRAFT_FACT_FIELDS,
  'customer_quotes',
  'notes',
  'business_name',
  'industry',
  'service_area',
] as const

export type AllowedFactField = (typeof ALLOWED_FACT_FIELDS)[number]

export type FactRejection = {
  fact: Partial<SpecFact>
  reason:
    | 'evidence_not_found'
    | 'evidence_too_short'
    | 'no_source_url'
    | 'unknown_field'
    | 'empty_value'
    | 'quote_not_from_review'
    | 'craft_field_not_verbatim'
    | 'contains_contact_details'
    | 'admin_fact_needs_source_note'
    | 'admin_fact_needs_attribution'
}

/**
 * Contact details must never travel as a *fact*.
 *
 * A directory listing puts the owner's personal email and mobile in the page
 * text, and an extractor will happily lift them into `notes` — from where they
 * reach the brief and then the generated site. That would publish somebody's
 * personal address on a site they never asked for, and it contradicts the
 * placeholder-email design that keeps us from contacting them prematurely.
 *
 * The phone and address we legitimately show come from the structured lead
 * fields, which are what the business chose to list publicly, not from prose
 * an LLM decided to keep.
 */
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/
const PHONE_RE = /(?:\+?\d[\s().-]{0,2}){9,}\d/

export function containsContactDetails(value: string): boolean {
  return EMAIL_RE.test(value) || PHONE_RE.test(value)
}

export type VerifyFactsResult = {
  accepted: SpecFact[]
  rejected: FactRejection[]
}

/**
 * Loose comparison for the containment check: collapse whitespace and drop the
 * punctuation a model habitually normalises (smart quotes, dashes). Deliberately
 * NOT a fuzzy match — it must still be the same words in the same order.
 */
export function normalizeForEvidence(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[‐-―]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Short spans match by accident — "we do" appears in almost any page. A fact
 * whose evidence is a handful of characters proves nothing about provenance.
 */
const MIN_EVIDENCE_CHARS = 12

/**
 * An admin fact's note is its whole provenance. "owner" or "call" tells a later
 * reviewer nothing; enough length to force a sentence is the cheapest way to
 * make the field carry real information.
 */
const MIN_ADMIN_NOTE_CHARS = 15

export function verifyFacts(
  candidates: Partial<SpecFact>[],
  pagesByUrl: Map<string, string>
): VerifyFactsResult {
  const accepted: SpecFact[] = []
  const rejected: FactRejection[] = []
  const reject = (fact: Partial<SpecFact>, reason: FactRejection['reason']) =>
    rejected.push({ fact, reason })

  const normalizedPages = new Map<string, string>()
  for (const [url, text] of pagesByUrl) {
    normalizedPages.set(url, normalizeForEvidence(text))
  }

  for (const candidate of candidates) {
    const field = candidate.field?.trim()
    const value = candidate.value?.trim()
    const evidence = candidate.evidence?.trim()
    const sourceUrl = candidate.sourceUrl?.trim()

    if (!value) {
      reject(candidate, 'empty_value')
      continue
    }
    if (!field || !(ALLOWED_FACT_FIELDS as readonly string[]).includes(field)) {
      reject(candidate, 'unknown_field')
      continue
    }
    if (containsContactDetails(value)) {
      reject(candidate, 'contains_contact_details')
      continue
    }

    // ── Admin-supplied facts take a different route to the same guarantee ──
    //
    // Most leads have nothing verifiable online — a page of marketing boiler-
    // plate and no measurements, brands or constraints anywhere. Those builds
    // dead-end, and the only way one becomes a site is a human ringing the
    // owner and writing down what they say. That fact cannot be checked against
    // a document, so it is checked against a person instead: a mandatory note
    // saying where it came from, and the admin's identity recorded with it.
    //
    // Never testimonials. A craft fact is the business's own claim, which its
    // owner can authorise; a testimonial is a statement attributed to a third
    // party, and no admin can vouch for what somebody's customer said.
    if (candidate.sourceKind === 'admin_manual') {
      if (field === 'customer_quotes') {
        reject(candidate, 'quote_not_from_review')
        continue
      }
      const note = candidate.note?.trim()
      if (!note || note.length < MIN_ADMIN_NOTE_CHARS) {
        reject(candidate, 'admin_fact_needs_source_note')
        continue
      }
      if (!candidate.addedBy?.trim()) {
        reject(candidate, 'admin_fact_needs_attribution')
        continue
      }
      accepted.push({
        field,
        value,
        // The note stands in for page evidence: it is what a reviewer reads to
        // decide whether to believe the claim.
        evidence: note,
        sourceUrl: '',
        sourceKind: 'admin_manual',
        capturedAt: candidate.capturedAt || new Date().toISOString(),
        // Authoritative as typed, so it may fill a craft_* column — which is
        // the entire point of the escape hatch.
        verbatim: true,
        note,
        addedBy: candidate.addedBy.trim(),
      })
      continue
    }

    if (!sourceUrl) {
      reject(candidate, 'no_source_url')
      continue
    }
    if (!evidence || evidence.length < MIN_EVIDENCE_CHARS) {
      reject(candidate, 'evidence_too_short')
      continue
    }

    // The proof. The evidence must appear in the page it claims to come from —
    // not in some other page we happened to fetch.
    const page = normalizedPages.get(sourceUrl)
    if (!page || !page.includes(normalizeForEvidence(evidence))) {
      reject(candidate, 'evidence_not_found')
      continue
    }

    const sourceKind = (candidate.sourceKind ?? 'maps_listing') as SpecFactSourceKind
    const verbatim = normalizeForEvidence(value) === normalizeForEvidence(evidence)

    // Testimonials may only ever be real reviews, quoted exactly. A paraphrased
    // "review" is a fabricated customer statement, which is the worst thing
    // this pipeline could put on a page.
    if (field === 'customer_quotes') {
      if (sourceKind !== 'maps_review') {
        reject(candidate, 'quote_not_from_review')
        continue
      }
      if (!verbatim) {
        reject(candidate, 'craft_field_not_verbatim')
        continue
      }
    }

    // The craft_* columns are the ONLY sanctioned source of concrete claims in
    // buildIntakeBrief. A paraphrase there is a model assertion wearing the
    // costume of an owner-supplied fact, so it is demoted rather than trusted.
    if ((CRAFT_FACT_FIELDS as readonly string[]).includes(field) && !verbatim) {
      reject(candidate, 'craft_field_not_verbatim')
      continue
    }

    accepted.push({
      field,
      value,
      evidence,
      sourceUrl,
      sourceKind,
      capturedAt: candidate.capturedAt || new Date().toISOString(),
      verbatim,
    })
  }

  return { accepted, rejected }
}
