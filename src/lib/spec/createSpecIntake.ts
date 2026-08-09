import { randomUUID } from 'node:crypto'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { hasProprietaryDetail, mapFactsToIntake } from '@/lib/spec/research/mapFactsToIntake'
import type { SpecBuildRow, SpecFact } from '@/lib/spec/types'

/**
 * Create the `prospect_intakes` row a spec build will be provisioned from —
 * the "robot prospect" filling in the form.
 *
 * It writes the row directly rather than going through POST /api/intake/[token]
 * because there is no browser and no prospect. That has one consequence worth
 * naming: `stripUneditedCraftSuggestions`, which protects the normal flow from
 * AI-suggested facts being accepted verbatim, lives in that route and does not
 * run here. The equivalent protection for this path is `verifyFacts`, which is
 * stricter — it requires evidence from a real page rather than merely a human
 * having edited the text.
 */

/**
 * Per-build placeholder. Unique on purpose: provisionTenant tears down any
 * existing tenant whose owner_email collides, so a shared address would make
 * each spec build silently delete the one before it.
 */
export function placeholderOwnerEmail(buildId: string): string {
  const domain = (process.env.SPEC_PLACEHOLDER_EMAIL_DOMAIN || 'ditchtheform.com').trim()
  return `spec+${buildId}@${domain}`
}

export type CreateSpecIntakeResult = {
  intakeId: string
  token: string
  placeholderEmail: string
  hasProprietaryDetail: boolean
}

export async function createSpecIntake(
  build: SpecBuildRow,
  facts: SpecFact[]
): Promise<CreateSpecIntakeResult> {
  const supabase = getSupabaseAdmin()
  const placeholderEmail = build.placeholder_owner_email || placeholderOwnerEmail(build.id)

  const { patch } = mapFactsToIntake(build.lead_input, facts, { placeholderEmail })

  // Idempotent: a re-run reuses the row rather than orphaning the first one,
  // which matters because spec_builds.intake_id is UNIQUE.
  if (build.intake_id) {
    const { data: existing } = await supabase
      .from('prospect_intakes')
      .select('id, token')
      .eq('id', build.intake_id)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('prospect_intakes')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      return {
        intakeId: existing.id as string,
        token: existing.token as string,
        placeholderEmail,
        hasProprietaryDetail: hasProprietaryDetail(patch),
      }
    }
  }

  const token = randomUUID().replace(/-/g, '')
  const { data, error } = await supabase
    .from('prospect_intakes')
    .insert({
      ...patch,
      token,
      // Stays 'draft' here. Phase 3 flips it to 'submitted' at the point it
      // actually hands off to provisioning — nothing should provision from a
      // row whose images and site config have not been generated yet.
      status: 'draft',
      scraper_lead_id: build.scraper_lead_id,
      provisioning_mode: 'auto',
      // No verification email is ever sent for a spec build; the address is
      // ours, and marking it verified keeps the submit path from trying.
      verification_email: placeholderEmail,
      email_verified_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('id, token')
    .single()

  if (error) throw error

  await supabase
    .from('spec_builds')
    .update({
      intake_id: data.id,
      placeholder_owner_email: placeholderEmail,
      updated_at: new Date().toISOString(),
    })
    .eq('id', build.id)

  return {
    intakeId: data.id as string,
    token: data.token as string,
    placeholderEmail,
    hasProprietaryDetail: hasProprietaryDetail(patch),
  }
}
