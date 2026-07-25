/**
 * Shared anti-AI copy rules for intake site generation and surgical text edits.
 * Keep wording concrete: models follow explicit bans better than "sound human."
 */

export const HUMAN_COPY_VOICE_RULES = `HUMAN VOICE (NON-NEGOTIABLE for all headlines, subheads, body, CTAs, process steps, service blurbs, FAQ, testimonials labels):
Write like a sharp local owner or their best salesperson — specific, useful, slightly imperfect. Prefer short sentences and concrete nouns (trade, city, materials, outcomes). Active voice. One idea per sentence when possible.

Banned AI tells (never use these words/phrases unless the business brief already contains them verbatim):
Elevate, Elevating, Seamless, Unleash, Empower, Supercharge, Next-generation, Next-gen, Revolutionize, Unlock, Transform your, Look no further, We've got you covered, Your one-stop shop, Cutting-edge, State-of-the-art, World-class, Best-in-class, Tailored solutions, Holistic, Synergy, Leverage, Utilize (prefer "use"), Delve, Embark, Journey, Passion/Passionate about (as filler), Commitment to excellence, Unparalleled, Unmatched quality, Experience the difference, Take your … to the next level, In today's fast-paced world, Whether you're looking for, Not just X — Y, From X to Y and beyond.

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
