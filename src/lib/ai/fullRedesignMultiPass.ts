/**
 * Multi-pass Full redesign orchestration helpers (pure).
 * Model I/O lives in generateCustomSite.ts — this module is checkpoint/resume math.
 */
import {
  isUsableCustomPageHtml,
  applyPathAliasesToCustomConfig,
  dropEmptyCustomPages,
  assertFullRedesignPagesComplete,
} from '@/lib/ai/fullRedesignPages'
import type { CustomPageArtifact, CustomSiteConfig } from '@/lib/customSite'
import { normalizeCustomPath } from '@/lib/customSite'

export type FullRedesignProgress = {
  pass: string
  passesDone: string[]
  requiredPaths: string[]
  reply?: string
}

/** Paths still needing usable HTML (resume skips completed ones). */
export function remainingFullRedesignPaths(
  requiredPaths: string[],
  draft: CustomSiteConfig | null | undefined
): string[] {
  return requiredPaths
    .map((p) => normalizeCustomPath(p))
    .filter((path) => {
      const page =
        draft?.pages?.[path] || (path === '/' ? draft?.pages?.[''] : undefined)
      return !isUsableCustomPageHtml(page?.html)
    })
}

export function mergePageIntoDraft(
  draft: CustomSiteConfig,
  path: string,
  page: CustomPageArtifact,
  globalCss?: string
): CustomSiteConfig {
  const key = normalizeCustomPath(path)
  return {
    mode: draft.mode === 'iframe' ? 'iframe' : 'inline',
    globalCss:
      typeof globalCss === 'string' && globalCss.trim()
        ? globalCss
        : draft.globalCss,
    pages: {
      ...draft.pages,
      [key]: page,
    },
  }
}

export function finalizeFullRedesignDraft(
  draft: CustomSiteConfig,
  requiredPaths: string[]
): CustomSiteConfig {
  const cleaned = dropEmptyCustomPages(applyPathAliasesToCustomConfig(draft))
  assertFullRedesignPagesComplete(cleaned, requiredPaths)
  return cleaned
}

/**
 * Pull a short chrome sample from home HTML so later pages match header/footer
 * without re-sending the entire home document.
 */
export function extractChromeSample(homeHtml: string, maxChars = 2800): string {
  const html = homeHtml || ''
  if (!html) return ''
  const header = html.match(/<header[\s\S]*?<\/header>/i)?.[0] || ''
  const nav = html.match(/<nav[\s\S]*?<\/nav>/i)?.[0] || ''
  const footer = html.match(/<footer[\s\S]*?<\/footer>/i)?.[0] || ''
  const sample = [header || nav, footer].filter(Boolean).join('\n\n')
  if (sample.length <= maxChars) return sample
  return `${sample.slice(0, maxChars)}\n<!-- truncated chrome sample -->`
}

export function passesDoneFromDraft(
  requiredPaths: string[],
  draft: CustomSiteConfig | null | undefined
): string[] {
  return requiredPaths
    .map((p) => normalizeCustomPath(p))
    .filter((path) => {
      const page =
        draft?.pages?.[path] || (path === '/' ? draft?.pages?.[''] : undefined)
      return isUsableCustomPageHtml(page?.html)
    })
}

export function emptyFullRedesignDraft(mode: 'inline' | 'iframe'): CustomSiteConfig {
  return { mode, pages: {} }
}
