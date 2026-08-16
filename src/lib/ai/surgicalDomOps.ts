/**
 * Cheerio-based surgical DOM ops — apply tree edits without whole-page LLM HTML.
 */

import * as cheerio from 'cheerio'
import type { AnyNode, Element } from 'domhandler'
import type { CustomPageArtifact, CustomSiteConfig } from '@/lib/customSite'

export const MAX_SURGICAL_OPS = 20
export const MAX_OP_STRING = 2000
export const MAX_SET_HTML = 4000

export type ReplaceTextOp = {
  op: 'replaceText'
  find: string
  replace: string
  scope?: 'all' | string
}

export type SetAttrOp = {
  op: 'setAttr'
  selector: string
  attr: string
  value: string
}

export type SetHtmlOp = {
  op: 'setHtml'
  selector: string
  html: string
}

export type AppendCssOp = {
  op: 'appendCss'
  css: string
}

/**
 * Literal find/replace inside globalCss — the only op that can change or remove
 * a rule that already exists.
 *
 * Without it "delete the counter-increment declarations" was inexpressible:
 * appendCss is additive, so a request to REMOVE css could only ever be answered
 * by piling an override on top, and a model that could not comply still
 * reported that it had. An empty `replace` is the deletion form.
 */
export type EditCssOp = {
  op: 'editCss'
  find: string
  replace: string
}

export type WrapOp = {
  op: 'wrap'
  selector: string
  wrapperHtml: string
}

export type UnwrapOp = {
  op: 'unwrap'
  selector: string
}

export type SurgicalDomOp =
  | ReplaceTextOp
  | SetAttrOp
  | SetHtmlOp
  | AppendCssOp
  | EditCssOp
  | WrapOp
  | UnwrapOp

export type ApplyOpsHtmlResult = {
  html: string
  hits: number
}

export type ApplyOpsPagesResult = {
  pages: Record<string, CustomPageArtifact>
  hits: number
  changedPages: string[]
  globalCssAppend: string | null
  /** Rewritten globalCss when editCss ops matched; null when untouched. */
  globalCssEdited: string | null
  /** editCss ops whose `find` was not present, so the caller can say so. */
  unmatchedCssEdits: string[]
}

const ALLOWED_OPS = new Set([
  'replaceText',
  'setAttr',
  'setHtml',
  'appendCss',
  'editCss',
  'wrap',
  'unwrap',
])

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function asNonEmptyString(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  if (!t || t.length > max) return null
  return t
}

/**
 * Validate and coerce unknown JSON into a closed SurgicalDomOp list.
 * Rejects unknown ops, oversized payloads, and empty lists.
 */
export function parseSurgicalOps(raw: unknown): {
  ops: SurgicalDomOp[]
  errors: string[]
} {
  const errors: string[] = []
  if (!Array.isArray(raw)) {
    return { ops: [], errors: ['ops must be an array'] }
  }
  if (raw.length === 0) {
    return { ops: [], errors: ['ops array is empty'] }
  }
  if (raw.length > MAX_SURGICAL_OPS) {
    return {
      ops: [],
      errors: [`ops exceeds max of ${MAX_SURGICAL_OPS}`],
    }
  }

  const ops: SurgicalDomOp[] = []
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i]
    if (!isPlainObject(item) || typeof item.op !== 'string') {
      errors.push(`ops[${i}]: invalid op object`)
      continue
    }
    if (!ALLOWED_OPS.has(item.op)) {
      errors.push(`ops[${i}]: unknown op "${item.op}"`)
      continue
    }

    switch (item.op) {
      case 'replaceText': {
        const find = asNonEmptyString(item.find, MAX_OP_STRING)
        const replace =
          typeof item.replace === 'string' && item.replace.length <= MAX_OP_STRING
            ? item.replace
            : null
        if (!find || replace === null) {
          errors.push(`ops[${i}]: replaceText needs find/replace strings`)
          break
        }
        const scope =
          item.scope === undefined || item.scope === 'all'
            ? 'all'
            : asNonEmptyString(item.scope, 200)
        if (item.scope !== undefined && item.scope !== 'all' && !scope) {
          errors.push(`ops[${i}]: invalid scope`)
          break
        }
        ops.push({
          op: 'replaceText',
          find,
          replace,
          scope: scope || 'all',
        })
        break
      }
      case 'setAttr': {
        const selector = asNonEmptyString(item.selector, 200)
        const attr = asNonEmptyString(item.attr, 64)
        const value =
          typeof item.value === 'string' && item.value.length <= MAX_OP_STRING
            ? item.value
            : null
        if (!selector || !attr || value === null) {
          errors.push(`ops[${i}]: setAttr needs selector/attr/value`)
          break
        }
        if (!/^[a-zA-Z_:][-a-zA-Z0-9_:.]*$/.test(attr)) {
          errors.push(`ops[${i}]: invalid attr name`)
          break
        }
        ops.push({ op: 'setAttr', selector, attr, value })
        break
      }
      case 'setHtml': {
        const selector = asNonEmptyString(item.selector, 200)
        const html =
          typeof item.html === 'string' && item.html.length <= MAX_SET_HTML
            ? item.html
            : null
        if (!selector || html === null) {
          errors.push(
            `ops[${i}]: setHtml needs selector and html (max ${MAX_SET_HTML} chars)`
          )
          break
        }
        ops.push({ op: 'setHtml', selector, html })
        break
      }
      case 'appendCss': {
        const css = asNonEmptyString(item.css, 8000)
        if (!css) {
          errors.push(`ops[${i}]: appendCss needs css string`)
          break
        }
        ops.push({ op: 'appendCss', css })
        break
      }
      case 'editCss': {
        const find = asNonEmptyString(item.find, MAX_OP_STRING)
        if (!find) {
          errors.push(`ops[${i}]: editCss needs a non-empty find string`)
          break
        }
        // Deletion is the point, so an empty replace is valid — but it has to
        // be a string, not a missing key that silently becomes "undefined".
        const replaceRaw = item.replace
        if (typeof replaceRaw !== 'string' || replaceRaw.length > MAX_OP_STRING) {
          errors.push(`ops[${i}]: editCss needs a replace string (use "" to delete)`)
          break
        }
        ops.push({ op: 'editCss', find, replace: replaceRaw })
        break
      }
      case 'wrap': {
        const selector = asNonEmptyString(item.selector, 200)
        const wrapperHtml = asNonEmptyString(item.wrapperHtml, MAX_SET_HTML)
        if (!selector || !wrapperHtml) {
          errors.push(`ops[${i}]: wrap needs selector/wrapperHtml`)
          break
        }
        // Must contain a single open tag with a closing placeholder child or be
        // a simple element — cheerio wrap requires a valid wrapper fragment.
        if (!/^<[a-zA-Z][^>]*>/.test(wrapperHtml.trim())) {
          errors.push(`ops[${i}]: wrap wrapperHtml must start with a tag`)
          break
        }
        ops.push({ op: 'wrap', selector, wrapperHtml })
        break
      }
      case 'unwrap': {
        const selector = asNonEmptyString(item.selector, 200)
        if (!selector) {
          errors.push(`ops[${i}]: unwrap needs selector`)
          break
        }
        ops.push({ op: 'unwrap', selector })
        break
      }
      default:
        errors.push(`ops[${i}]: unhandled op`)
    }
  }

  return { ops, errors }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function replaceAllIgnoreCase(
  haystack: string,
  find: string,
  replace: string
): { text: string; hits: number } {
  if (!find || !haystack) return { text: haystack, hits: 0 }
  const re = new RegExp(escapeRegExp(find), 'gi')
  let hits = 0
  const text = haystack.replace(re, () => {
    hits += 1
    return replace
  })
  return { text, hits }
}

function replaceInTextNodes(
  $: cheerio.CheerioAPI,
  root: cheerio.Cheerio<AnyNode>,
  find: string,
  replace: string
): number {
  let hits = 0
  root.contents().each((_, node) => {
    if (node.type === 'text') {
      const data = node.data || ''
      const next = replaceAllIgnoreCase(data, find, replace)
      if (next.hits > 0) {
        hits += next.hits
        node.data = next.text
      }
      return
    }
    if (node.type === 'tag') {
      const el = node as Element
      const name = (el.name || '').toLowerCase()
      if (name === 'script' || name === 'style') return
      hits += replaceInTextNodes($, $(el), find, replace)
    }
  })
  return hits
}

function applyOneOp(
  $: cheerio.CheerioAPI,
  op: SurgicalDomOp
): { hits: number; cssAppend: string | null } {
  if (op.op === 'appendCss') {
    return { hits: 1, cssAppend: op.css }
  }

  let hits = 0
  switch (op.op) {
    case 'replaceText': {
      const scope =
        !op.scope || op.scope === 'all' ? $.root() : $(op.scope)
      if (!scope.length && op.scope && op.scope !== 'all') {
        return { hits: 0, cssAppend: null }
      }
      // Also replace in attributes that commonly hold copy (title, aria-label, alt)
      // when doing a global find — keep mechanical renames consistent.
      hits += replaceInTextNodes($, scope, op.find, op.replace)
      if (!op.scope || op.scope === 'all') {
        $('[title], [aria-label], [alt], [placeholder]').each((_, el) => {
          for (const attr of ['title', 'aria-label', 'alt', 'placeholder'] as const) {
            const v = $(el).attr(attr)
            if (!v) continue
            const next = replaceAllIgnoreCase(v, op.find, op.replace)
            if (next.hits > 0) {
              hits += next.hits
              $(el).attr(attr, next.text)
            }
          }
        })
      }
      break
    }
    case 'setAttr': {
      const nodes = $(op.selector)
      nodes.each((_, el) => {
        $(el).attr(op.attr, op.value)
        hits += 1
      })
      break
    }
    case 'setHtml': {
      const nodes = $(op.selector)
      if (nodes.length === 0) break
      // Apply to first match only — avoid mass wipe.
      nodes.first().html(op.html)
      hits += 1
      break
    }
    case 'wrap': {
      const nodes = $(op.selector)
      nodes.each((_, el) => {
        $(el).wrap(op.wrapperHtml)
        hits += 1
      })
      break
    }
    case 'unwrap': {
      const nodes = $(op.selector)
      nodes.each((_, el) => {
        $(el).replaceWith($(el).contents())
        hits += 1
      })
      break
    }
  }
  return { hits, cssAppend: null }
}

/** Apply ops to a single HTML fragment. */
export function applyOpsToHtml(
  html: string,
  ops: SurgicalDomOp[]
): ApplyOpsHtmlResult {
  const pageOps = ops.filter((o) => o.op !== 'appendCss')
  if (!pageOps.length) {
    return { html: html || '', hits: 0 }
  }
  const $ = cheerio.load(html || '', { xml: false }, false)
  let hits = 0
  for (const op of pageOps) {
    hits += applyOneOp($, op).hits
  }
  return { html: $.root().html() || '', hits }
}

/**
 * Apply ops across all pages. Collects appendCss separately (never replaces
 * globalCss wholesale).
 */
export function applyOpsToPages(
  pages: Record<string, CustomPageArtifact>,
  ops: SurgicalDomOp[],
  /** Current globalCss, required for editCss to have anything to edit. */
  baseGlobalCss = ''
): ApplyOpsPagesResult {
  const cssParts: string[] = []
  for (const op of ops) {
    if (op.op === 'appendCss') cssParts.push(op.css)
  }

  // editCss rewrites the existing sheet; every occurrence of `find` is
  // replaced, because a declaration a model wants gone usually appears in more
  // than one rule.
  let editedCss: string | null = null as string | null
  const unmatchedCssEdits: string[] = []
  let cssHits = 0
  for (const op of ops) {
    if (op.op !== 'editCss') continue
    const current: string = editedCss ?? baseGlobalCss
    if (!current.includes(op.find)) {
      unmatchedCssEdits.push(op.find)
      continue
    }
    const occurrences = current.split(op.find).length - 1
    editedCss = current.split(op.find).join(op.replace)
    cssHits += occurrences
  }

  const pageOps = ops.filter((o) => o.op !== 'appendCss' && o.op !== 'editCss')

  const next: Record<string, CustomPageArtifact> = {}
  let hits = 0
  const changedPages: string[] = []

  for (const [path, page] of Object.entries(pages || {})) {
    if (!page) continue
    if (!pageOps.length) {
      next[path] = { ...page }
      continue
    }
    const before = page.html || ''
    const applied = applyOpsToHtml(before, pageOps)
    hits += applied.hits
    const changed = applied.html !== before
    if (changed) changedPages.push(path)
    next[path] = {
      ...page,
      html: applied.html,
    }
  }

  // appendCss counts as a hit when present so integrity path can append.
  if (cssParts.length) {
    hits += cssParts.length
  }

  hits += cssHits

  return {
    pages: next,
    hits,
    changedPages,
    globalCssAppend: cssParts.length ? cssParts.join('\n\n') : null,
    globalCssEdited: editedCss,
    unmatchedCssEdits,
  }
}

/** Compact digest for LLM op-list prompts (not full HTML). */
export function buildPageDigest(
  pages: Record<string, CustomPageArtifact>,
  opts: { maxPages?: number; maxTextPerPage?: number; maxHrefs?: number } = {}
): Array<{
  path: string
  text: string
  hrefs: string[]
  titles: string[]
}> {
  const maxPages = opts.maxPages ?? 12
  const maxText = opts.maxTextPerPage ?? 1200
  const maxHrefs = opts.maxHrefs ?? 12
  const out: Array<{
    path: string
    text: string
    hrefs: string[]
    titles: string[]
  }> = []

  for (const [path, page] of Object.entries(pages || {})) {
    if (out.length >= maxPages) break
    if (!page?.html) continue
    const $ = cheerio.load(page.html, { xml: false }, false)
    $('script, style, noscript, svg').remove()
    const rawText = $('body').text() || $.root().text() || ''
    const text = rawText.replace(/\s+/g, ' ').trim().slice(0, maxText)
    const hrefs: string[] = []
    $('a[href]').each((_, el) => {
      if (hrefs.length >= maxHrefs) return false
      const href = $(el).attr('href')
      if (href) hrefs.push(href)
    })
    const titles: string[] = []
    $('h1, h2, h3').each((_, el) => {
      if (titles.length >= 8) return false
      const t = $(el).text().replace(/\s+/g, ' ').trim()
      if (t) titles.push(t.slice(0, 120))
    })
    out.push({ path, text, hrefs, titles })
  }
  return out
}

/** Apply a validated op list onto a cloned custom site config. */
export function applyOpsToConfig(
  base: CustomSiteConfig,
  ops: SurgicalDomOp[]
): {
  config: CustomSiteConfig
  hits: number
  changedPages: string[]
  globalCssAppend: string | null
  globalCssChanged: boolean
  unmatchedCssEdits: string[]
} {
  const applied = applyOpsToPages(base.pages, ops, base.globalCss || '')
  return {
    config: {
      ...base,
      pages: applied.pages,
      // editCss rewrites the sheet in place; appendCss is merged later by the
      // caller, which owns the full-replace policy.
      ...(applied.globalCssEdited !== null ? { globalCss: applied.globalCssEdited } : {}),
    },
    hits: applied.hits,
    changedPages: applied.changedPages,
    globalCssAppend: applied.globalCssAppend,
    globalCssChanged: applied.globalCssEdited !== null,
    unmatchedCssEdits: applied.unmatchedCssEdits,
  }
}
