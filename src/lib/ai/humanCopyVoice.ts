/**
 * Shared anti-AI copy rules for intake site generation and surgical text edits.
 * Keep wording concrete: models follow explicit bans better than "sound human."
 */

export type AiTellRule = {
  phrase: string
  /** Narrow trade phrases where the words describe the product, not marketing tone. */
  allowedContexts?: readonly RegExp[]
}

/**
 * Machine-readable rules shared by prompts and shipped-copy validation.
 * Rules may exempt narrow, literal trade terminology; broad exemptions belong
 * in sourceText instead so generated marketing cannot bypass the gate.
 */
export const AI_TELL_RULES: readonly AiTellRule[] = [
  'elevate',
  'elevates',
  'elevating',
  'elevated',
  // "Seamless gutters" is the literal product name, including list forms like
  // "seamless aluminum, copper, and half-round gutter installation".
  { phrase: 'seamless', allowedContexts: [/\bseamless\b[^.!?]{0,60}\bgutters?\b/i] },
  'seamlessly',
  'unleash',
  'empower',
  'supercharge',
  'next-generation',
  'next-gen',
  'revolutionize',
  'unlock',
  'transform your',
  'look no further',
  "we've got you covered",
  'we have got you covered',
  'one-stop shop',
  'cutting-edge',
  'state-of-the-art',
  'world-class',
  'best-in-class',
  'tailored solutions',
  'holistic',
  'synergy',
  'leverage',
  'utilize',
  'delve',
  'embark',
  'commitment to excellence',
  'unparalleled',
  'unmatched quality',
  'experience the difference',
  'to the next level',
  "in today's fast-paced world",
  'in todays fast-paced world',
  "whether you're looking for",
  'whether you are looking for',
  'and beyond',
  'quiet luxury',
  'gallery-like restraint',
  'meticulously crafted',
  'nestled in',
  'at the heart of everything',
  'comprehensive',
  'game-changer',
  'streamline',
  'testament to',
  'we are committed to',
  'our team of experienced professionals',
  'whether you need',
].map((rule) => (typeof rule === 'string' ? { phrase: rule } : rule))

/** Backwards-compatible phrase list used to render the generation prompts. */
export const AI_TELL_PHRASES: readonly string[] = AI_TELL_RULES.map((rule) => rule.phrase)

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function findAiTellPhrases(text: string, sourceText = ''): string[] {
  const hits: string[] = []
  for (const rule of AI_TELL_RULES) {
    const phraseRe = new RegExp(`\\b${escapeRe(rule.phrase)}\\b`, 'gi')
    const sourceHasPhrase = sourceText ? phraseRe.test(sourceText) : false
    phraseRe.lastIndex = 0
    if (sourceHasPhrase) continue

    for (const match of text.matchAll(phraseRe)) {
      const start = Math.max(0, (match.index ?? 0) - 40)
      const end = Math.min(text.length, (match.index ?? 0) + match[0].length + 40)
      const context = text.slice(start, end)
      if (rule.allowedContexts?.some((allowed) => allowed.test(context))) continue
      hits.push(match[0])
    }
  }
  return hits
}

// ── Placeholder tells ────────────────────────────────────────────────────────
// Text that ships when a model or a template forgets to fill a slot. Unlike the
// marketing tells above these are never legitimate in customer-visible copy, so
// there is no allowedContexts escape hatch.

export const PLACEHOLDER_TELL_RES: readonly RegExp[] = [
  /\bjane\s+doe\b/gi,
  /\bjohn\s+doe\b/gi,
  /\b[\w.+-]+@example\.(?:com|org|net)\b/gi,
  /\blorem\b/gi,
  /\bTODO\b/g, // case-sensitive: "to do" in prose is fine, TODO markers are not
  /\boffering\s+\d+\b/gi, // "Offering 1", "Offering 2" slot names
  /\byour\s+(?:text|copy|content|headline)\s+here\b/gi,
  /\bplaceholder\b/gi,
]

/** Unfilled-slot text (Jane Doe, lorem, TODO, "Offering 3", …). */
export function findPlaceholderTells(text: string): string[] {
  const hits: string[] = []
  for (const re of PLACEHOLDER_TELL_RES) {
    re.lastIndex = 0
    for (const match of text.matchAll(re)) hits.push(match[0])
  }
  return Array.from(new Set(hits))
}

// ── Em dash in short copy ────────────────────────────────────────────────────
// In prose an em dash is a style choice; in a CTA, an eyebrow, a meta
// description or any other chrome string it is a generator fingerprint,
// because no human labels a button with one.

export const EM_DASH_SHORT_COPY_WORD_LIMIT = 24

export function hasEmDashInShortCopy(
  text: string,
  wordLimit = EM_DASH_SHORT_COPY_WORD_LIMIT
): boolean {
  if (!text.includes('—')) return false
  return text.trim().split(/\s+/).length <= wordLimit
}

// ── Formulaic titles ─────────────────────────────────────────────────────────
// "The {Brand} Method" and its siblings are a recognisable generator signature:
// the same fill-in-the-blank title on thousands of sites.

export const FORMULAIC_TITLE_RE =
  /\bThe\s+[A-Z][\w’']*\s+(?:Method|Approach|Difference|Promise|Standard|System|Blueprint|Process|Experience|Touch|Way\b|Care\s+(?:Approach|Standard|Process))\b/g

export function findFormulaicTitles(text: string): string[] {
  FORMULAIC_TITLE_RE.lastIndex = 0
  return Array.from(new Set((text.match(FORMULAIC_TITLE_RE) ?? []).map((m) => m.trim())))
}

export const HUMAN_COPY_VOICE_RULES = `HUMAN VOICE (NON-NEGOTIABLE for all headlines, subheads, body, CTAs, process steps, service blurbs, FAQ, testimonials labels):
Write like a sharp local owner or their best salesperson — specific, useful, slightly imperfect. Prefer short sentences and concrete nouns (trade, city, materials, outcomes). Active voice. One idea per sentence when possible.

Banned AI tells (never use these words/phrases unless the business brief already contains them verbatim):
${AI_TELL_PHRASES.join(', ')}.
Also banned in the same spirit: Journey, Passion/Passionate about (as filler), "Not just X — Y", "From X to Y".

Also ban:
- Em-dash stacks and "rule of three" filler lists that say nothing concrete
- Generic trust lines unless in the brief: "trusted local provider", "Licensed & insured", "Satisfaction guaranteed", "Free estimate" as empty slogans
- Fake enthusiasm, emoji in copy, and hollow intensifiers (truly, exceptionally, meticulously) without a fact
- Starting hero headlines with "Welcome to"

Prefer instead:
- Named services, places, timeframes, warranties, materials, or crew habits from the brief
- Plain CTAs ("Get a quote", "Call …", "Book this week") over clever abstractions
- Proof over adjectives: years, neighborhoods, response time, what's included`

/** Shorter block for surgical edits that only rewrite small copy slices. */
export const HUMAN_COPY_VOICE_RULES_SURGICAL = `When changing text/copy: write like a real local business owner — specific and plain. Never introduce AI marketing tells (Elevate, Seamless, Unleash, Empower, Unlock, Revolutionize, Look no further, We've got you covered, one-stop shop, cutting-edge, world-class, journey, delve, "take it to the next level", em-dash-heavy hype). Prefer concrete services, places, and outcomes already present in the site or business context.`
