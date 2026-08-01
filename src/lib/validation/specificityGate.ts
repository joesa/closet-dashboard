/**
 * The mechanical half of the swap test.
 *
 * FULL_REDESIGN_DESIGN_SYSTEM already ends with the right instruction — "if any
 * part could be find-and-replaced onto a different business, redo that part" —
 * but nothing measured it, so nothing enforced it. These checks are the cheap,
 * deterministic subset of that judgement: no model call, no network, so they can
 * run on every validation pass.
 *
 * What this can and cannot do: it detects copy that is *structurally* generic —
 * no numbers, no named things, no admitted constraints, plus phrases from the
 * shared ban list. It cannot tell good writing from bad. A page can pass every
 * check here and still be dull; nothing that fails them is bespoke.
 */

import { findAiTellPhrases } from '@/lib/ai/humanCopyVoice'

export type SpecificityCode =
  | 'copy_ai_tell_phrase'
  | 'copy_no_proprietary_detail'
  | 'copy_decorative_stat'
  | 'copy_uniform_positivity'

export type SpecificityFinding = {
  code: SpecificityCode
  message: string
  /** Offending excerpts, deduped, for the admin report. */
  samples: string[]
}

export type SpecificityInput = {
  /** Visible copy. Pass HTML or plain text; tags and entities are stripped. */
  text: string
  /** Business name and locality are excluded from "named thing" credit — every
   *  template already interpolates them, so they prove nothing about the copy. */
  businessName?: string | null
  locality?: string | null
  /** Verbatim owner-supplied language may be retained without blaming generation. */
  sourceText?: string | null
}

/** Round marketing numbers that read as decoration rather than measurement. */
const DECORATIVE_STAT_RE =
  /\b(?:100\s*%|110\s*%|24\s*\/\s*7|5[\s-]star|five[\s-]star|#1|no\.?\s*1|1000s|100s)\b/gi

/**
 * A real measurement: a number carrying a unit, a fraction, a range, or money.
 * Bare integers are deliberately excluded — "3 easy steps" is not a measurement.
 */
const MEASUREMENT_RE = new RegExp(
  [
    String.raw`\d+\s*[–\-]\s*\d+`, // ranges: 6–8
    String.raw`\d+\s*\/\s*\d+`, // fractions: 1/4
    String.raw`[¼½¾⅓⅔⅛]`, // vulgar fractions
    String.raw`\$\s?\d`, // money
    String.raw`\d+\s*(?:%|″|"|'|mm|cm|m\b|in\b|ft\b|inch|inches|foot|feet|yard|sq\b|kg|lb|lbs|k\b|K\b|hr|hrs|hour|hours|day|days|week|weeks|wk|wks|month|months|year|years|yr|yrs|gauge|ga\b|amp|amps|volt|volts|watt|watts|psi|rpm|degree|degrees|°)`,
  ].join('|'),
  'gi'
)

/**
 * Language that concedes a limit, an exception, or a fix. Uniform positivity is
 * the AI tell that survives every word filter, because no single word is wrong.
 */
const CONSTRAINT_RE =
  /\b(?:cannot|can't|won't|will not|don't|do not|never|rarely|unless|except|instead of|only if|no more than|at most|minimum|limit|limited to|too (?:small|large|old|tight|narrow)|went wrong|had to|comes? back|redo|reorder|out of square|behind schedule|we turned down|not a good fit|we don't)\b/i

/** Multi-word Capitalised Names — brands, streets, districts, materials. */
const PROPER_NOUN_RE = /\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})+\b/g

export function stripToText(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&(?:quot|#34);/gi, '"')
    .replace(/&(?:apos|#39);/gi, "'")
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function uniq(values: string[], cap = 6): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean))).slice(0, cap)
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Runs the deterministic checks over one page's copy.
 * Returns [] when the copy has nothing measurable wrong with it.
 */
export function analyzeSpecificity(input: SpecificityInput): SpecificityFinding[] {
  const text = stripToText(input.text)
  const findings: SpecificityFinding[] = []

  // 1. Phrases the prompt already bans. This runs even on short headlines and
  // CTAs; the broader specificity checks below need enough prose to be fair.
  const hits = findAiTellPhrases(text, input.sourceText || '')
  if (hits.length > 0) {
    findings.push({
      code: 'copy_ai_tell_phrase',
      message: `Copy contains ${hits.length} banned AI marketing tell${hits.length === 1 ? '' : 's'}. These are on the ban list in humanCopyVoice.ts, so generation was told to avoid them.`,
      samples: uniq(hits),
    })
  }

  // Very short pages (a bare contact stub) have nothing else to judge.
  if (text.split(/\s+/).length < 40) return findings

  // 2. The swap test proper. Strip the two values every template interpolates,
  //    then ask whether anything left ties this copy to this business.
  let residual = text
  for (const own of [input.businessName, input.locality]) {
    if (own?.trim()) residual = residual.replace(new RegExp(escapeRe(own.trim()), 'gi'), ' ')
  }
  const measurements = residual.match(MEASUREMENT_RE) ?? []
  const properNouns = (residual.match(PROPER_NOUN_RE) ?? []).filter(
    // Sentence-initial pairs like "We Build" are capitalisation, not names.
    (m) => !/^(?:We|Our|The|This|You|Your|Get|Call|Book)\b/.test(m)
  )
  if (measurements.length === 0 && properNouns.length === 0) {
    findings.push({
      code: 'copy_no_proprietary_detail',
      message:
        'Remove the business name and city and nothing identifies this business: no measurement, no named material, brand, or place. This copy would read identically on a competitor’s site.',
      samples: [],
    })
  }

  // 3. Round numbers used as decoration instead of measurement.
  const decorative = residual.match(DECORATIVE_STAT_RE) ?? []
  if (decorative.length > 0) {
    findings.push({
      code: 'copy_decorative_stat',
      message:
        'Copy leans on round marketing figures. Real operational numbers are odd-shaped ("6–8 weeks", "twice in nine years"); these read as filler and invite disbelief.',
      samples: uniq(decorative),
    })
  }

  return findings
}

/**
 * Tone balance is a whole-site property, not a per-page one: a site may quite
 * reasonably keep its one candid passage on the About page. Run this once over
 * every page's copy rather than per page, or it fires on pages that were never
 * the right place for a caveat.
 */
export function analyzeToneBalance(texts: string[]): SpecificityFinding[] {
  const combined = stripToText(texts.join(' \n '))
  // Below roughly a page of copy there is not enough material to expect nuance.
  if (combined.split(/\s+/).length < 90) return []
  if (CONSTRAINT_RE.test(combined)) return []
  return [
    {
      code: 'copy_uniform_positivity',
      message:
        'Nowhere on the site is there a limit, an exception, or something that went wrong and was put right. Uniformly positive copy is the AI tell that survives a word filter — real businesses say what they do not do.',
      samples: [],
    },
  ]
}
