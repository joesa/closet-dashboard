/**
 * Design system adapted from the Custom Build / Claude project brief:
 * subject-derived direction, anti-AI defaults, human voice, engagement engine.
 * Used when inventing a Full redesign prompt from intake (empty admin seed)
 * and when executing the site build.
 */

import { HUMAN_COPY_VOICE_RULES } from '@/lib/ai/humanCopyVoice'

/** Compact rules embedded in brief-enhancement + Full redesign system prompts. */
export const FULL_REDESIGN_DESIGN_SYSTEM = `DESIGN SYSTEM (from our studio / Claude project — non-negotiable):

Core: nothing may look AI-generated. Substitute for defaults is subject-derived design —
the product's materials, tools, artifacts, vernacular, locality, and audience. Name the
subject, audience, and the page's single job first; derive every visual and copy choice
from those.

Banned defaults (unless an admin seed explicitly requests them):
- Purple-to-blue / indigo SaaS gradients; gradients instead of a real palette
- Cream/off-white + high-contrast serif + terracotta/warm-clay habit skin
- Near-black + neon lime/cyan/gold "auto shop AI" skin; carbon texture; skewed italic CTAs
- Vague SaaS heroes ("Build faster…"), gradient blobs, abstract 3D
- Emoji in UI; glassmorphism; floating orbs; default dot-grids
- Three identical icon-title-sentence cards; Inter/Poppins/Roboto/Syne-by-habit
- Dual-lane gateways unless the business truly has two disciplines
- Invented testimonials, ratings, awards, years-in-business, lorem, TODOs

${HUMAN_COPY_VOICE_RULES}

SIGNATURE DEVICE (required — but never a shared house style):
Derive one memorable device from this business's actual work. It may be spatial,
typographic, photographic, tactile, navigational, or artifact-based. Do not assume every
trade should look like a technical document, field report, spec sheet, or editorial
spread. Across redesigns, vary the entire composition family, density, alignment,
image behavior, type scale, geometry, and chrome — not merely colors or section order.

SPECIFICITY FLOOR (bans alone do not produce bespoke — these are positive quotas):
- Every claim, statistic, timeframe, and process step traces to a supplied fact. If a
  section has no fact behind it, cut the section; do not inflate it with adjectives.
- Numbers carry units and are odd-shaped, because real measurements are: "1/4 inch",
  "6–8 weeks", "twice in nine years" — never "100%", "5-star", "24/7" as decoration.
- Name at least one real place smaller than the city (neighbourhood, road, district)
  where the brief supports it, and use named materials/brands over "premium materials".
- At least one section must admit a constraint, a limit, or something that went wrong
  and was fixed. Uniform positivity is the loudest AI tell that survives a word filter.
- Where facts are thin, the correct output is a shorter, quieter page — not a longer one.

Process every redesign must follow (even when inventing the prompt):
1) Understand product + audience + one conversion action (engagement engine — never HTML forms).
2) Lock a signature concept, material world, palette (hex), type pairing, one signature chrome element.
3) Self-check: would ten AI tools produce the same look? If yes, revise before building.
4) Build tokens → shared chrome → home → all intake pages; keep all intake services; mount engagement widget.
5) Motion: one deliberate CSS moment; respect prefers-reduced-motion.

Final check: if any part could be find-and-replaced onto a different business, redo that part.`

/** Extra instructions when the admin left the Full redesign prompt empty. */
export const EMPTY_SEED_DIRECTION_INSTRUCTIONS = `ADMIN SEED IS EMPTY — you must SELF-AUTHOR a complete design direction.

Do NOT ask for more input. Make an educated guess from intake (brand, services, city,
about/hero copy, theme hint, engagement model). Invent a NEW design direction that feels
like a deliberate studio choice for THIS trade in THIS place — not a generic template.

Your optimizedBrief MUST read as a ready-to-execute creative prompt an admin could have
typed, and MUST include these labeled sections in order:
1. DESIGN DIRECTION — one sharp concept + why it fits this business
2. MATERIAL WORLD — real trade materials/tools/surfaces that drive the look
3. PALETTE — 4–6 roles with hex + where used
4. TYPOGRAPHY — named Google Fonts (display + body) + why
5. SIGNATURE DEVICE — name a business-specific device; use paperwork only when the
  intake truly supports it, never as the default visual language
6. LAYOUT & HIERARCHY — choose a composition family unlike every design in the avoid
  list; do not default to alternating image/text bands or a fixed section sequence
7. COPY REGISTER — how headlines/CTAs should sound (human voice rules above)
8. PROCESS — the build steps the site generator must follow (direction lock → tokens → pages)
9. ANTI-AI SELF-CHECK — which default clusters you rejected and why
10. ENGAGEMENT — which engine stays (quote/booking/order/ticket) and that the widget mount stays

Be concrete and opinionated. Prefer light or mid surfaces unless intake facts demand dark.
Never invent fake stats or testimonials.`
