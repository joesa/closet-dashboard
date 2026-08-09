import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { createSpecIntake } from '@/lib/spec/createSpecIntake'
import { CRAFT_FACT_FIELDS, verifyFacts } from '@/lib/spec/research/verifyFacts'
import { getSpecBuild, transitionSpecBuild } from '@/lib/spec/specBuilds'
import type { SpecBuildRow, SpecFact } from '@/lib/spec/types'

/**
 * The escape hatch: let an admin supply the one fact that rescues a lead.
 *
 * Most cold leads publish nothing verifiable — a page of marketing boilerplate
 * with no measurement, brand or constraint anywhere. Research correctly returns
 * nothing, `hasProprietaryDetail` is false, and the build stops rather than
 * spending on a site that would fail the copy gate with a finding no machine
 * can repair. Without a way to add a fact by hand, those leads are simply dead.
 *
 * This is deliberately narrow. An admin may add the business's own operational
 * claims — what they measure, what they refuse, what they use — because the
 * owner can authorise those. An admin may never add a testimonial, because a
 * testimonial is attributed to a third party nobody here can speak for.
 */

/** Columns an admin may fill. Deliberately excludes customer_quotes. */
export const ADMIN_FACT_FIELDS = CRAFT_FACT_FIELDS

export type AddAdminFactInput = {
  buildId: string
  field: string
  value: string
  /** Where the admin got this — a call, a text, a site visit. Mandatory. */
  note: string
  addedBy: string
}

export type AddAdminFactResult =
  | { ok: true; factCount: number; status: string; redrafted: boolean }
  | { ok: false; reason: string }

export async function addAdminFact(input: AddAdminFactInput): Promise<AddAdminFactResult> {
  const build = await getSpecBuild(input.buildId)
  if (!build) return { ok: false, reason: 'Spec build not found.' }

  if (!(ADMIN_FACT_FIELDS as readonly string[]).includes(input.field)) {
    // Testimonials are the field someone is most likely to reach for, and the
    // one with the worst failure mode, so it gets an explanation rather than a
    // shrug. (verifyFacts refuses it too — this is the friendlier of two guards.)
    return {
      ok: false,
      reason:
        input.field === 'customer_quotes'
          ? 'Testimonials can only come from real reviews we can link to. You can vouch for what the business tells you about its own work, but not for what one of their customers said.'
          : 'That column cannot be filled by hand.',
    }
  }

  // Run the candidate through the same verifier every scraped fact goes
  // through, rather than trusting the form. The admin branch has its own rules
  // (note + attribution required, never a testimonial) and this is what
  // enforces them — there is no second, laxer path into the ledger.
  const { accepted, rejected } = verifyFacts(
    [
      {
        field: input.field,
        value: input.value,
        sourceKind: 'admin_manual',
        note: input.note,
        addedBy: input.addedBy,
        capturedAt: new Date().toISOString(),
      },
    ],
    new Map()
  )

  if (accepted.length === 0) {
    return { ok: false, reason: describeRejection(rejected[0]?.reason) }
  }

  const existing = build.research?.facts ?? []
  const facts = [...existing, accepted[0]]

  await getSupabaseAdmin()
    .from('spec_builds')
    .update({
      research: { ...(build.research ?? {}), facts },
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.buildId)

  const redrafted = await redraftFromFacts({ ...build, research: { ...build.research, facts } }, facts)

  return {
    ok: true,
    factCount: facts.length,
    status: redrafted ? 'drafting' : build.status,
    redrafted,
  }
}

/**
 * Rewrite the intake row from the current fact set and, if it now carries a
 * concrete claim, release the build from needs_attention.
 *
 * Deliberately does not re-run research: the admin has just supplied what
 * research could not find, and paying for another fetch and extraction to
 * rediscover nothing would be pure waste.
 */
export async function redraftFromFacts(
  build: SpecBuildRow,
  facts: SpecFact[]
): Promise<boolean> {
  const result = await createSpecIntake(build, facts)
  if (!result.hasProprietaryDetail) return false

  await transitionSpecBuild(build.id, ['needs_attention', 'queued', 'researching'], 'drafting', {
    intake_id: result.intakeId,
    status_reason: null,
    last_error: null,
  })
  return true
}

function describeRejection(reason?: string): string {
  switch (reason) {
    case 'admin_fact_needs_source_note':
      return 'Say where this came from — a call, a text, a site visit. A later reviewer needs to be able to judge it.'
    case 'admin_fact_needs_attribution':
      return 'Could not record who added this fact.'
    case 'quote_not_from_review':
      return 'Testimonials can only come from real reviews. Nobody can vouch for what somebody else’s customer said.'
    case 'contains_contact_details':
      return 'Facts must not contain phone numbers or email addresses — those come from the lead record.'
    case 'unknown_field':
      return 'That column cannot be filled by hand.'
    case 'empty_value':
      return 'Enter the fact.'
    default:
      return 'That fact could not be accepted.'
  }
}
