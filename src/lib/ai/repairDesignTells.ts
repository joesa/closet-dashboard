/**
 * Targeted repair of design tells found mid-generation.
 *
 * Until now every gate ran at publish, after a 20-45 minute job: generation
 * never saw a violation and never corrected one, so the admin's only remedy was
 * to run the whole thing again. This module closes that loop — after each
 * checkpoint the orchestrator scans the unit it just produced, and if something
 * blocking is there it hands the model the exact violations and asks for that
 * unit back.
 *
 * Three properties matter more than the repair itself:
 *
 * 1. It cannot make things worse. Every repaired unit passes back through
 *    assertSurgicalIntegrity (the same guard surgical edits use) plus a set of
 *    invariants the repair prompt is told about: the widget mount, the fonts
 *    link, the chrome landmarks, and every image URL that was there before. A
 *    unit that fails any of them is rolled back to the original and reported.
 * 2. It cannot loop. generateWithQualityRetry caps attempts and breaks on a
 *    no-progress hash, so a model that keeps returning the same text stops
 *    costing calls.
 * 3. It cannot break resume. This module never touches the draft — the caller
 *    checkpoints the raw unit first, repairs, then checkpoints again.
 *
 * `callModel` and `scan` are injected so this never imports generateCustomSite,
 * which would be a cycle.
 */

import {
  generateWithQualityRetry,
  type UnitQualityReport,
} from '@/lib/ai/generateWithQualityRetry'
import {
  applySurgicalIntegrityRepairs,
  assertSurgicalIntegrity,
} from '@/lib/ai/surgicalIntegrity'
import { isUsableCustomPageHtml } from '@/lib/ai/fullRedesignPages'
import { WIDGET_PLACEHOLDER, type CustomSiteConfig } from '@/lib/customSite'
import {
  describeDesignTellsForPrompt,
  GLOBAL_CSS_UNIT_ID as GLOBAL_CSS_SCANNER_ID,
  type DesignTellFinding,
} from '@/lib/validation/designTellScanner'
import { MAX_REPAIR_ATTEMPTS_PER_UNIT } from '@/lib/validation/designGuardPolicy'

/** unitId -> content. Prefixed so the model cannot confuse CSS with HTML. */
export type RepairUnits = Record<string, string>

const GLOBAL_CSS_UNIT = 'css:__global__'

export function unitIdForGlobalCss(): string {
  return GLOBAL_CSS_UNIT
}

export function unitIdForPage(path: string): string {
  return `html:${path}`
}

export function isGlobalCssUnit(unitId: string): boolean {
  return unitId === GLOBAL_CSS_UNIT
}

export function pathForUnitId(unitId: string): string | null {
  return unitId.startsWith('html:') ? unitId.slice('html:'.length) : null
}

/**
 * Translate a scanner finding's unitId into a repair unit id.
 *
 * The scanner speaks in artifact terms ('globalCss', '/about') because that is
 * what a validation report should say; the repair loop needs the type prefix so
 * the model cannot return CSS where HTML belongs. Without this mapping the
 * per-finding FIX sentences silently fail to match and the model gets a generic
 * instruction instead of the specific one.
 */
export function repairUnitIdForFinding(unitId: string): string {
  if (unitId === GLOBAL_CSS_SCANNER_ID) return GLOBAL_CSS_UNIT
  if (unitId.startsWith('css:') || unitId.startsWith('html:')) return unitId
  return unitIdForPage(unitId)
}

export function unitsFromDraft(draft: CustomSiteConfig, paths: string[]): RepairUnits {
  const units: RepairUnits = {}
  if (typeof draft.globalCss === 'string' && draft.globalCss.trim()) {
    units[GLOBAL_CSS_UNIT] = draft.globalCss
  }
  for (const path of paths) {
    const html = draft.pages?.[path]?.html
    if (typeof html === 'string' && html.trim()) units[unitIdForPage(path)] = html
  }
  return units
}

/** Merge repaired units back into a draft without disturbing anything else. */
export function applyRepairedUnits(
  draft: CustomSiteConfig,
  units: RepairUnits
): CustomSiteConfig {
  const pages = { ...draft.pages }
  let globalCss = draft.globalCss
  for (const [unitId, value] of Object.entries(units)) {
    if (isGlobalCssUnit(unitId)) {
      if (value.trim()) globalCss = value
      continue
    }
    const path = pathForUnitId(unitId)
    if (!path || !pages[path]) continue
    if (!isUsableCustomPageHtml(value)) continue
    pages[path] = { ...pages[path], html: value }
  }
  return { ...draft, globalCss, pages }
}

// ── invariants a repair must not break ──────────────────────────────────────

function imageUrls(html: string): string[] {
  return Array.from(html.matchAll(/src\s*=\s*["'](https:\/\/[^"']+)["']/gi)).map((m) => m[1])
}

function hasFontsLink(html: string): boolean {
  return /fonts\.googleapis\.com/i.test(html)
}

/**
 * Why a repaired unit was rejected, or null if it is safe to accept.
 * These are the things the repair prompt explicitly tells the model to preserve,
 * checked rather than trusted.
 */
export function rejectRepairedUnit(
  unitId: string,
  before: string,
  after: string
): string | null {
  if (!after.trim()) return 'returned empty content'

  if (isGlobalCssUnit(unitId)) {
    // Catastrophic CSS loss is caught by assertSurgicalIntegrity; here we only
    // guard against a repair that quietly drops the whole token block.
    const beforeTokens = (before.match(/--[a-zA-Z][\w-]*\s*:/g) || []).length
    const afterTokens = (after.match(/--[a-zA-Z][\w-]*\s*:/g) || []).length
    if (beforeTokens >= 4 && afterTokens < beforeTokens * 0.5) {
      return `dropped ${beforeTokens - afterTokens} of ${beforeTokens} design tokens`
    }
    return null
  }

  if (!isUsableCustomPageHtml(after)) return 'returned unusable page HTML'
  if (before.includes(WIDGET_PLACEHOLDER) && !after.includes(WIDGET_PLACEHOLDER)) {
    return 'removed the engagement widget mount'
  }
  if (hasFontsLink(before) && !hasFontsLink(after)) {
    return 'removed the Google Fonts stylesheet link'
  }
  const lost = imageUrls(before).filter((url) => !after.includes(url))
  if (lost.length > 0) return `dropped ${lost.length} image URL(s): ${lost[0]}`
  return null
}

// ── the repair call ─────────────────────────────────────────────────────────

const REPAIR_SYSTEM = `You repair specific defects in an already-built page of a bespoke local-business website. You are NOT redesigning anything.

Fix ONLY the numbered violations you are given. Do not restructure the page, do not rewrite copy that is not named in a violation, and do not "improve" anything else — an unrequested change is a failure, not a bonus.

NEVER remove or alter:
- the <!-- CLOSET_WIDGET --> comment (the engagement engine mounts there)
- the <link rel="stylesheet" href="https://fonts.googleapis.com/..."> element
- <header>, <nav> or <footer>, or the class names on existing elements
- any https:// image URL already present
- the :root design tokens, unless a violation is specifically about them

Platform rules still apply: body HTML only, no <script>, no <iframe>, no <form>, no on* attributes, no javascript: URLs. CSS may use @media, @keyframes and @font-face but not @import.

Return ONLY a JSON object whose keys are the exact unit ids you were given and whose values are the full repaired content for those units. Emit no other keys.`

export type RepairResult = {
  units: RepairUnits
  report: UnitQualityReport
  attempts: number
  repairedUnitIds: string[]
  /** Units whose repair broke an invariant and was reverted. */
  rolledBackUnitIds: string[]
  warnings: string[]
}

export async function repairDesignTells(opts: {
  units: RepairUnits
  findings: DesignTellFinding[]
  brandName: string
  directionBlock: string
  pageHints: string
  callModel: (args: {
    systemPrompt: string
    userPrompt: string
    maxOutputTokens: number
    abortMs: number
    temperature?: number
  }) => Promise<Record<string, unknown>>
  scan: (units: RepairUnits) => UnitQualityReport
  maxRetries?: number
}): Promise<RepairResult> {
  const original = { ...opts.units }
  const warnings: string[] = []
  const rolledBackUnitIds: string[] = []

  const result = await generateWithQualityRetry<RepairUnits>({
    initial: opts.units,
    validate: opts.scan,
    maxRetries: opts.maxRetries ?? MAX_REPAIR_ATTEMPTS_PER_UNIT,
    regenerate: async ({ failedUnitIds, findings, current }) => {
      const violations = describeDesignTellsForPrompt(
        // The retry loop hands back UnitQualityFindings; map them onto the
        // richer scanner findings so the model gets the FIX sentence too.
        findings.map((f) => {
          const full = opts.findings.find(
            (candidate) =>
              candidate.code === f.code &&
              repairUnitIdForFinding(candidate.unitId) === f.unitId
          )
          return (
            full ?? {
              code: f.code as DesignTellFinding['code'],
              unitId: f.unitId,
              severity: 'error' as const,
              message: f.message,
              fix: 'Remove the offending pattern.',
              samples: f.samples,
            }
          )
        })
      )

      const userPrompt = `Repair units for "${opts.brandName}".

LOCKED DESIGN DIRECTION (do not depart from it — the repair must stay on-brief):
${opts.directionBlock}

SITE PATHS (any internal href must use one of these exactly): ${opts.pageHints}

VIOLATIONS TO FIX:
${violations}

UNITS TO RETURN (repair each one; keys must match exactly):
${JSON.stringify(
  Object.fromEntries(failedUnitIds.map((id) => [id, current[id] ?? ''])),
  null,
  1
)}

Return JSON keyed by those unit ids only.`

      const parsed = await opts.callModel({
        systemPrompt: REPAIR_SYSTEM,
        userPrompt,
        maxOutputTokens: failedUnitIds.some(isGlobalCssUnit) ? 12000 : 8000,
        abortMs: failedUnitIds.some(isGlobalCssUnit) ? 240_000 : 180_000,
        temperature: 0.3,
      })

      const out: RepairUnits = {}
      for (const unitId of failedUnitIds) {
        const value = parsed[unitId]
        if (typeof value !== 'string' || !value.trim()) continue
        const reason = rejectRepairedUnit(unitId, original[unitId] ?? '', value)
        if (reason) {
          if (!rolledBackUnitIds.includes(unitId)) rolledBackUnitIds.push(unitId)
          warnings.push(`Design repair for ${unitId} was reverted — it ${reason}.`)
          continue
        }
        out[unitId] = value
      }
      return out
    },
  })

  // Second safety net: the same integrity guard surgical edits run through.
  // rejectRepairedUnit checks units in isolation; this compares the assembled
  // before/after and reverts a chrome-stripping or CSS-gutting result.
  const asConfig = (units: RepairUnits) => ({
    globalCss: units[GLOBAL_CSS_UNIT] ?? '',
    pages: Object.fromEntries(
      Object.entries(units)
        .filter(([id]) => !isGlobalCssUnit(id))
        .map(([id, html]) => [pathForUnitId(id) ?? id, { html }])
    ),
  })
  const integrity = assertSurgicalIntegrity(asConfig(original), asConfig(result.output))
  let units = result.output
  if (!integrity.ok) {
    const restored = applySurgicalIntegrityRepairs(
      { ...asConfig(units), pages: { ...asConfig(units).pages } },
      integrity
    )
    units = { ...units }
    if (typeof integrity.repaired.globalCss === 'string') {
      units[GLOBAL_CSS_UNIT] = restored.globalCss ?? original[GLOBAL_CSS_UNIT]
      if (!rolledBackUnitIds.includes(GLOBAL_CSS_UNIT)) rolledBackUnitIds.push(GLOBAL_CSS_UNIT)
    }
    for (const path of Object.keys(integrity.repaired.pages || {})) {
      const unitId = unitIdForPage(path)
      units[unitId] = original[unitId] ?? units[unitId]
      if (!rolledBackUnitIds.includes(unitId)) rolledBackUnitIds.push(unitId)
    }
    warnings.push(...integrity.warnings)
  }

  const repairedUnitIds = Object.keys(units).filter(
    (id) => units[id] !== original[id] && !rolledBackUnitIds.includes(id)
  )
  if (result.retryError) {
    warnings.push(`Design repair pass stopped early: ${result.retryError}`)
  }

  return {
    units,
    report: opts.scan(units),
    attempts: result.attempts,
    repairedUnitIds,
    rolledBackUnitIds,
    warnings,
  }
}
