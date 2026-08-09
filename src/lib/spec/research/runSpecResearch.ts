import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { extractFactsFromPage } from '@/lib/spec/research/extractFacts'
import { fetchPageText, firecrawlConfigured } from '@/lib/spec/research/fetchPage'
import { resolveResearchSources } from '@/lib/spec/research/sources'
import { verifyFacts, type FactRejection } from '@/lib/spec/research/verifyFacts'
import type { SpecBuildRow, SpecFact } from '@/lib/spec/types'

/**
 * Gather and verify every fact a spec build is allowed to assert.
 *
 * Order matters: fetch, then extract per page, then verify against the page the
 * fact claims to come from. Verification is deliberately the last step and
 * operates on the fetched text rather than anything the model returned, so no
 * amount of confident output can route around it.
 *
 * Never throws for a source that fails. A business with no Facebook page and a
 * Maps listing that will not load simply yields no facts, and the caller
 * decides whether that build is worth continuing.
 */

export type SpecResearchOutcome = {
  facts: SpecFact[]
  rejected: FactRejection[]
  fetched: { url: string; sourceKind: string; chars: number; error?: string }[]
  /** Set when nothing could be fetched at all, for the admin ledger. */
  blockedReason?: string
}

export async function runSpecResearch(build: SpecBuildRow): Promise<SpecResearchOutcome> {
  const lead = build.lead_input
  const outcome: SpecResearchOutcome = { facts: [], rejected: [], fetched: [] }

  const sources = resolveResearchSources(lead)
  const capturedProfile = lead.publicProfileResearch
  if (sources.length === 0 && !capturedProfile) {
    outcome.blockedReason =
      'No public sources for this lead — no Google Maps listing and no Facebook page.'
    return outcome
  }
  if (!firecrawlConfigured() && !capturedProfile) {
    outcome.blockedReason = 'FIRECRAWL_API_KEY is not set, so no page could be read.'
    return outcome
  }

  const pagesByUrl = new Map<string, string>()
  const candidates: Partial<SpecFact>[] = []

  if (capturedProfile) {
    pagesByUrl.set(capturedProfile.sourceUrl, capturedProfile.text)
    outcome.fetched.push({
      url: capturedProfile.sourceUrl,
      sourceKind: 'facebook_about',
      chars: capturedProfile.text.length,
    })
    const extracted = await extractFactsFromPage(
      {
        url: capturedProfile.sourceUrl,
        sourceKind: 'facebook_about',
        text: capturedProfile.text,
      },
      { name: build.business_name, city: build.city, services: lead.services }
    )
    if (extracted.error) outcome.fetched[0].error = `extraction failed: ${extracted.error}`
    candidates.push(...extracted.candidates)
  }

  for (const source of sources) {
    if (capturedProfile && source.sourceKind === 'facebook_about') continue
    const page = await fetchPageText(source.url, source.sourceKind)
    outcome.fetched.push({
      url: page.url,
      sourceKind: page.sourceKind,
      chars: page.text.length,
      error: page.error,
    })
    if (!page.text.trim()) continue

    pagesByUrl.set(page.url, page.text)

    const extracted = await extractFactsFromPage(page, {
      name: build.business_name,
      city: build.city,
      services: lead.services,
    })
    if (extracted.error) {
      const entry = outcome.fetched[outcome.fetched.length - 1]
      entry.error = `extraction failed: ${extracted.error}`
    }
    candidates.push(...extracted.candidates)
  }

  if (pagesByUrl.size === 0) {
    const failures = outcome.fetched
      .map((source) => `${source.sourceKind}: ${source.error || 'no readable text'}`)
      .join('; ')
    outcome.blockedReason = `No source produced readable text.${failures ? ` ${failures}` : ''}`
    return outcome
  }

  const verified = verifyFacts(candidates, pagesByUrl)
  outcome.facts = verified.accepted
  outcome.rejected = verified.rejected
  return outcome
}

/** Persist research onto the build so the admin ledger can render it. */
export async function saveSpecResearch(
  build: SpecBuildRow,
  outcome: SpecResearchOutcome
): Promise<void> {
  const { publicProfileResearch: _discarded, ...retainedLeadInput } = build.lead_input
  const { error } = await getSupabaseAdmin()
    .from('spec_builds')
    .update({
      // Full browser text is temporary. Keep only verified evidence excerpts
      // in research once extraction has completed.
      lead_input: retainedLeadInput,
      research: {
        facts: outcome.facts,
        fetched: outcome.fetched,
        // Kept for the admin view: seeing what was thrown away, and why, is how
        // you tell "the business is quiet online" from "the extractor is broken".
        rejected: outcome.rejected.map((r) => ({
          reason: r.reason,
          field: r.fact.field,
          value: (r.fact.value || '').slice(0, 200),
        })),
      },
      research_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', build.id)
  if (error) throw new Error(`Failed to save spec research: ${error.message}`)
}
