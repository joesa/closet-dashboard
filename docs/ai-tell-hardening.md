# AI-tell hardening: taxonomy, enforcement, and fleet remediation

Date: 2026-08-08. Companion to `plan-eliminateAiTells.prompt.md` (workspace root).
This is the reference doc for how the platform detects, blocks, and remediates
"AI tells" — the generic, template-generated language and design fingerprints
that make a site look machine-made instead of hand-built.

## 1. Taxonomy of tells

All detectors are deterministic (no model calls) and live in
`src/lib/ai/humanCopyVoice.ts` (dashboard) with a hash-pinned mirror at
`custom-closets-websites/src/lib/humanCopyVoice.ts`.

| Class | Examples | Detector |
|---|---|---|
| Banned marketing phrases | "seamless", "elevate", "comprehensive", "bespoke", "uncompromising", "vision into reality" (context-aware where needed: "seamless gutters" is legitimate trade language) | `findAiTellPhrases` |
| Placeholder slots | "Jane Doe", "jane@example.com", "123-456-7890", "MyCity, MS", "lorem", "TODO", "Offering 3" | `findPlaceholderTells` |
| Em dash in short copy | headlines, CTAs, labels under 24 words containing "—" | `hasEmDashInShortCopy` |
| Formulaic titles | "The {Brand} Method / Approach / Way / Process / Promise" | `findFormulaicTitles` |
| Structurally generic copy | no measurement, no named material/brand/place once business name + city are removed | `analyzeSpecificity` → `copy_no_proprietary_detail` |
| Decorative stats | "100%", "24/7", "5-star", "#1" used as filler | `analyzeSpecificity` → `copy_decorative_stat` |
| Uniform positivity | whole site with no limit, exception, or admitted constraint | `analyzeToneBalance` → `copy_uniform_positivity` |
| Fabricated proof | invented testimonials, ratings, review counts | policy, not a scanner: testimonials are only generated from contractor-supplied verbatim quotes (`prospect_intakes.customer_quotes`); otherwise the page is omitted |
| Identical chrome | same nav CTA / widget heading / quiz copy on every site | seeded pools in renderer `chromeCopy.ts`, CI-guarded |
| Design fingerprints | wrong JSON-LD `@type` on every site, "Template Factory" metadata, shared hero fallback image, unthemed engines | fixed at source; renderer `designAudit.ts` shares the phrase ban list |

### Cross-repo sync

`AI_TELL_RULES` is canonical in the dashboard. Both repos pin the same content
hash in `humanCopyVoice.test.ts` (`AI_TELL_CANON_HASH`); editing one copy
without the other breaks both builds. Renderer `designAudit.ts` consumes the
mirrored list plus renderer-only extras.

## 2. Enforcement matrix

| Surface | Before this work | Now |
|---|---|---|
| Full redesign (custom builds) | hard-gated (`scanArtifactTells` + publish gate) | unchanged |
| Engine drafts (promote) | hard-gated | unchanged |
| Standard provisioning | copy findings warning-only; approve never blocked | copy findings are **errors** for tenants created after the cutoff (below); `validation_status='failed'` blocks approve + auto-launch |
| Intake page copy (`generate-page-copy`) | ungated; prompt *asked* for fabricated testimonials | voice rules in prompt, `generateWithQualityRetry` + `validateGeneratedUnits`, testimonials only from real quotes |
| Site config generation (`generateSiteConfig`) | testimonials page implied invented quotes | facts-only clause; testimonials page excluded unless real quotes exist in the brief |
| Admin sandbox copy (`/api/ai/generate-copy`) | ungated | voice rules + validation with one retry |
| Admin site chat (`adminSiteChat`) | applied any change unvalidated | every copy string in `changes` checked (tells, placeholders, decorative stats); one retry then reject |
| Quiz / industry / ideal-customer generators | ungated | voice rules + `'label'`-profile validation, fallback/filter on failure |
| Craft suggestions (`suggestCraftAnswers`) | invented "facts" laundered into briefs if accepted unedited | unedited suggestions tagged client-side and stripped server-side before the brief; UI shows a "replace with your real details" hint |
| Hardcoded fallback copy (catalogs, defaultCopy, siteSignature) | never scanned | de-telled + CI guard test scans every constant on each build |
| Renderer chrome | identical literals fleet-wide | seeded, engagement-model-aware pools (`chromeCopy.ts`) + CI guard |
| Existing live tenants | nothing | dry-run-first fleet remediation covers structured copy, custom HTML, and custom-page metadata; unsupported claims use reviewed exact replacements |

### The cutoff

`COPY_ENFORCEMENT_CUTOFF_ISO` in `src/lib/validation/siteValidator.ts`
(default `2026-08-08T00:00:00Z`, overridable via `COPY_GATE_CUTOFF_ISO`).
Tenants created on/after it fail validation on copy findings; older tenants
keep warnings so nothing live breaks retroactively. This is a deploy-date
constant, not a schema flag, by design (see plan "open items").

### Auto-repair

`autoFixTenantSite` handles banned phrases, placeholders, formulaic titles, and
short-copy em dashes. It locates offending strings across structured copy,
secondary pages, quiz copy, custom HTML text nodes, and custom-page title/
description metadata. Punctuation-only repairs are deterministic. Contextual
rewrites use an object-shaped JSON contract, preserve concrete facts, and are
re-checked before any write. Invalid or unchanged output fails closed.
`copy_no_proprietary_detail` is deliberately **not** auto-fixable — the missing
fact is something only the owner can supply.

## 3. Fleet audit (existing tenants)

```bash
npm run audit:ai-tells              # full audit incl. live homepage crawl
npm run audit:ai-tells -- --no-crawl   # config copy only (fast, offline)
npm run audit:ai-tells -- --tenant <id>
npm run audit:ai-tells -- --all        # include draft/pending/archived tenants
```

By default the audit covers live (`site_status='active'`) tenants only. Writes
`audit-output/ai-tell-audit-<date>.{json,md}` (gitignored — contains tenant
data). Read-only: it never writes to the database. Each finding carries
the exact config path (e.g. `products_config[1].description`) and the matched
sample, so remediation can be surgical.

Active-fleet baseline on 2026-08-08: 32 tenants, 3 clean, 29 with findings.
After reviewed remediation and a live crawl, all active configs and reachable
sites have zero banned phrases, placeholders, formulaic titles, short-copy em
dashes, and unsupported decorative statistics. Eighteen tenants are fully
clean. The remaining 14 each have only `copy_uniform_positivity`; they need a
real owner-supplied limitation, exception, or corrected-job detail. The system
does not invent one to force a green report.

### Remediation paths, in order of preference

1. `autoFixTenantSite(tenantId)` — safe for `ai_tell_phrase` findings.
2. Admin site chat — now gated, so its edits cannot re-introduce tells.
3. Regeneration via intake page-copy (now gated) when a whole page is generic.
4. Manual edit for `copy_no_proprietary_detail` — requires a real fact from
   the owner (measurement, material, named place, admitted constraint).

Fleet operations are dry-run-first:

```bash
npm run remediate:ai-tells -- --audit audit-output/<report>.json
npm run remediate:ai-tells -- --audit audit-output/<report>.json --phrases-only --apply
npm run remediate:ai-tells -- --audit audit-output/<report>.json --mechanical-only --apply
```

`scripts/remediate-unverified-legacy-claims.ts` contains exact, reviewed legacy
claim removals with match-count guards. It must be dry-run before `--apply`.

## 4. CI guards (fail the build, not the tenant)

| Test | Repo | What it protects |
|---|---|---|
| `humanCopyVoice.test.ts` (hash pin) | both | rule-list drift between repos |
| `fallbackCopy.aiTells.test.ts` | dashboard | every hardcoded fallback constant + industry catalog stays tell-free |
| `chromeCopy.test.ts` | renderer | chrome pools tell-free, deterministic per seed, varied across seeds, legacy literals stay dead |
| `siteValidator.copyGate.test.ts` | dashboard | cutoff semantics (legacy tenants never enforced retroactively) |

`autoFixTenantSite` copy repair uses `generateWithQualityRetry` (same retry wrapper as gated generation surfaces).

### Still open (Phase 6 craft excellence)

Core Phase 0–5 enforcement is implemented. Phase 6 work remains:

- Deeper template craft pass (modular type/line-length system, per-theme image art-direction beyond hero variants)
- Full browser-backed WCAG AA enumeration for every custom artifact; the shared
  theme matrix and representative 390x844 browser probes pass, but no Lighthouse/
  axe CLI is installed in this environment
- Full design-QA rubric (spacing rhythm, focus states, orphan sections) beyond landmarks/h1/alts/footer
- Owner fact collection for the 14 `copy_uniform_positivity` blockers

The Full Redesign capacity exercise used two reviewed localhost-only fixtures
with the same queue timestamp. It exposed an exhausted 14-pair typography pool;
the curated pool now has 30 pairs and a probe-capacity regression test. A local
worker on the corrected revision completed all four Alpha draft pages in 189
seconds without publishing. A remote worker on the previously deployed revision
claimed Beta and failed the old uniqueness preflight, confirming that production
workers need the corrected revision before the added capacity is operational.

Fail-first convention: when touching these lists, temporarily add a banned
phrase (e.g. "seamless") to a guarded constant and confirm the test fails
before trusting a green run.

## 5. Decisions of record

- Testimonials are never fabricated. No real quotes → no testimonials page.
- Errors block new provisions only; existing tenants go through the audit
  report and a user-approved remediation pass.
- Footer and booking/ticket engine theming are in scope for the renderer.
- Detection stays deterministic (no LLM judges), consistent with the existing
  scanner architecture.
