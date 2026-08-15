import { generateTextForPurpose } from '@/lib/ai/aiTextProvider'
import { parseAiSiteJson } from '@/lib/ai/generateSiteConfig'
import type { SpecFact } from '@/lib/spec/types'
import type { FetchedPage } from '@/lib/spec/research/fetchPage'

/**
 * Pull candidate facts out of one fetched page.
 *
 * Nothing this returns is trusted — `verifyFacts` re-checks every `evidence`
 * span against the page text and drops whatever does not appear. The prompt
 * asks for evidence anyway because a model told to quote its source produces
 * markedly better candidates than one told merely to be truthful, and because
 * candidates that fail verification are wasted spend.
 *
 * The extraction is tuned toward what the specificity gate actually counts:
 * measurements and multi-word proper nouns. That is not a trick — those are
 * exactly the things that make copy about this business rather than any
 * business, which is the same reason the gate looks for them.
 */

const FIELD_GUIDE = `
craft_spec          What they measure and to what tolerance. Numbers, units.
shop_rule           A rule they never break. Often phrased as "we always/never…".
local_conditions    What goes wrong on jobs in this specific area, and why.
crew_shape          Who actually does the work — crew size, tenure, who shows up.
client_artifact     What the customer physically receives or signs off on.
recent_job          One real job, with a place or a detail that pins it down.
competitor_tell     What cheaper competitors get wrong, concretely.
timeline_facts      Real timeframes. "Same week", "6-8 weeks", "two visits".
guarantee_terms     A guarantee in the owner's own words.
signature_materials Named brands, materials or equipment. Comma separated.
customer_quotes     A REVIEW, copied exactly. Only from review text. Never edited.
notes               Anything else concrete and true that does not fit above.
`

const SYSTEM = `You extract verifiable facts about a small business from a page
of text, for a website that will be shown to that business's own owner.

The single rule that matters: EVERY fact must include an "evidence" field
containing text copied EXACTLY, character for character, from the page you were
given. Not a summary of it. Not a cleaned-up version. The literal substring.
Any fact whose evidence does not appear verbatim in the page is discarded by an
automated check, so inventing one wastes the slot and helps nobody.

Do NOT infer, assume, generalise or fill gaps. If the page does not say how long
they have been in business, there is no fact about how long they have been in
business. A thin result is correct when the page is thin.

Prefer facts containing:
  - measurements and numbers with units ("3.5 inches", "6-8 weeks", "two crews")
  - named brands, materials, equipment, streets, neighbourhoods
  - something they will NOT do, a limit, or a condition they insist on
Those are what make copy specific to this business. Generic praise
("great service", "professional team") is worthless — skip it entirely.

NEVER extract as a fact:
  - email addresses, phone numbers, or street addresses
  - opening hours, ratings, review counts, or anything else a directory lists
    about every business
We already hold all of that as structured data. It is not a fact about how
this business works, and an automated check discards it anyway. Facts describe
the WORK: how they do it, what they use, what they refuse, what went wrong once
and how they fixed it.

For "value": use the owner's own words wherever possible. For the craft fields
and for customer_quotes, value MUST equal evidence exactly — those columns are
reserved for verbatim language. For "notes" you may condense.`

export type ExtractFactsResult = {
  candidates: Partial<SpecFact>[]
  provider?: string
  error?: string
}

export async function extractFactsFromPage(
  page: FetchedPage,
  business: { name: string; city?: string | null; services?: string[] }
): Promise<ExtractFactsResult> {
  if (!page.text.trim()) return { candidates: [], error: page.error || 'empty page' }

  const quotesAllowed = page.sourceKind === 'maps_review' || page.sourceKind === 'yelp_review'

  const prompt = `Business: ${business.name}${business.city ? ` in ${business.city}` : ''}
${business.services?.length ? `Known services: ${business.services.join(', ')}` : ''}
Source: ${page.url} (${page.sourceKind})

Target fields:
${FIELD_GUIDE}
${
  quotesAllowed
    ? 'This page contains customer reviews. Extract up to 4 of the most specific ones into customer_quotes, copied exactly.'
    : 'This page is NOT a review source. Do not produce any customer_quotes facts from it.'
}

Return JSON only:
{"facts":[{"field":"<one of the fields above>","value":"<what to put in the column>","evidence":"<exact substring from the page below>"}]}

Return {"facts":[]} if the page contains nothing concrete. That is a normal and
acceptable answer.

--- PAGE TEXT ---
${page.text}
--- END PAGE TEXT ---`

  try {
    const result = await generateTextForPurpose('spec_research_facts', {
      prompt,
      systemPrompt: SYSTEM,
      jsonMode: true,
      temperature: 0,
      maxOutputTokens: 4096,
    })

    const parsed = parseAiSiteJson(result.text)
    const rawFacts = Array.isArray((parsed as { facts?: unknown })?.facts)
      ? ((parsed as { facts: unknown[] }).facts as Record<string, unknown>[])
      : []

    const candidates: Partial<SpecFact>[] = rawFacts
      .filter((f) => f && typeof f === 'object')
      .map((f) => ({
        field: typeof f.field === 'string' ? f.field.trim() : undefined,
        value: typeof f.value === 'string' ? f.value.trim() : undefined,
        evidence: typeof f.evidence === 'string' ? f.evidence.trim() : undefined,
        sourceUrl: page.url,
        // The model does not get to choose provenance — it is a property of the
        // page we fetched, not something to be claimed.
        sourceKind: page.sourceKind,
        capturedAt: new Date().toISOString(),
      }))

    return { candidates, provider: result.provider }
  } catch (err) {
    return {
      candidates: [],
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
