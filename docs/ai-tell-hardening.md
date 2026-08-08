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
| Banned marketing phrases | "seamless", "elevate", "comprehensive", "we are committed to", "transform your", "look no further" (~50 rules, some context-aware: "seamless gutters" is legitimate trade language) | `findAiTellPhrases` |
| Placeholder slots | "Jane Doe", "jane@example.com", "lorem", "TODO", "Offering 3" | `findPlaceholderTells` |
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
| Existing live tenants | nothing | fleet audit report (below); remediation is a separate, reviewed follow-up |

### The cutoff

`COPY_ENFORCEMENT_CUTOFF_ISO` in `src/lib/validation/siteValidator.ts`
(default `2026-08-08T00:00:00Z`, overridable via `COPY_GATE_CUTOFF_ISO`).
Tenants created on/after it fail validation on copy findings; older tenants
keep warnings so nothing live breaks retroactively. This is a deploy-date
constant, not a schema flag, by design (see plan "open items").

### Auto-repair

`autoFixTenantSite` handles `copy_ai_tell_phrase`: it locates the offending
strings inside the tenant's `site_configs` copy columns, rewrites them in one
model call (voice rules embedded, concrete facts preserved), re-checks every
rewrite with `findAiTellPhrases`, and only persists clean ones.
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

Baseline run 2026-08-08 (config-only): 88 tenants audited, 22 clean, 66 with
findings; dominant classes were `ai_tell_phrase` and `copy_no_proprietary_detail`
on legacy provisions predating the Craft & proof intake step.

### Remediation paths, in order of preference

1. `autoFixTenantSite(tenantId)` — safe for `ai_tell_phrase` findings.
2. Admin site chat — now gated, so its edits cannot re-introduce tells.
3. Regeneration via intake page-copy (now gated) when a whole page is generic.
4. Manual edit for `copy_no_proprietary_detail` — requires a real fact from
   the owner (measurement, material, named place, admitted constraint).

## 4. CI guards (fail the build, not the tenant)

| Test | Repo | What it protects |
|---|---|---|
| `humanCopyVoice.test.ts` (hash pin) | both | rule-list drift between repos |
| `fallbackCopy.aiTells.test.ts` | dashboard | every hardcoded fallback constant + industry catalog stays tell-free |
| `chromeCopy.test.ts` | renderer | chrome pools tell-free, deterministic per seed, varied across seeds, legacy literals stay dead |
| `siteValidator.copyGate.test.ts` | dashboard | cutoff semantics (legacy tenants never enforced retroactively) |

`autoFixTenantSite` copy repair uses `generateWithQualityRetry` (same retry wrapper as gated generation surfaces).

### Still open (Phase 6 craft excellence)

Core Phase 0–5 enforcement is implemented. Remaining hardening work includes
persisted Craft-suggestion provenance, broader fallback/chrome coverage, and
unsupported copy finding repair paths. Phase 6 work remains:

- Deeper template craft pass (modular type/line-length system, per-theme image art-direction beyond hero variants)
- Theme-token WCAG AA CI for all template themes; CWV budget checks in siteValidator
- Full design-QA rubric (spacing rhythm, focus states, orphan sections) beyond landmarks/h1/alts/footer
- Admin batch full-redesign for selected standard sites + cost/latency budget doc

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
