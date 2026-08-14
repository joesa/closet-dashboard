import { analyzeRenderedDesign } from '@/lib/validation/siteValidator'
import type { CustomSiteConfig } from '@/lib/customSite'

/**
 * Catch a save that quietly guts a page.
 *
 * Incident (2026-08-13): clicking inside a hero selected the whole
 * `<section class="hero">`, "Remove" deleted it in one click, and the autosave
 * published a homepage with no `<h1>`. Nothing server-side objected — engine
 * mode protects its structure via PROTECTED_ENGINE_SECTIONS, but custom mode
 * only checked "html non-empty + widget present".
 *
 * These rules are advisory, not absolute: deleting a hero on purpose is a
 * legitimate redesign. The save path turns a hit into a confirmable 409 rather
 * than a hard refusal.
 */

export type ContentLossReason = {
  code: 'lost_h1' | 'lost_main' | 'content_shrank' | 'page_removed'
  page: string
  message: string
}

export class ContentLossError extends Error {
  readonly reasons: ContentLossReason[]
  constructor(reasons: ContentLossReason[]) {
    super('This edit removes a large part of the page.')
    this.name = 'ContentLossError'
    this.reasons = reasons
  }
}

/** Visible text length, tags stripped and whitespace collapsed. */
function textLength(html: string): number {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().length
}

function elementCount(html: string): number {
  return (html.match(/<[a-z][a-z0-9]*[\s/>]/gi) || []).length
}

function hasFinding(html: string, code: string): boolean {
  return analyzeRenderedDesign(html, { renderMode: 'custom' }).some((finding) => finding.code === code)
}

/** True when `next` newly trips a structural finding that `previous` did not. */
function newlyBroken(previousHtml: string, nextHtml: string, code: string): boolean {
  return !hasFinding(previousHtml, code) && hasFinding(nextHtml, code)
}

function pageLabel(path: string): string {
  return path === '/' ? 'home page' : `page ${path}`
}

/**
 * Compare a stored custom-site config against the one about to replace it.
 *
 * Both sides must be post-`hardenCustomConfig`, otherwise normalization reads
 * as loss. Returns an empty array when the edit is safe.
 */
export function detectCustomContentLoss(
  previous: CustomSiteConfig | null | undefined,
  next: CustomSiteConfig | null | undefined
): ContentLossReason[] {
  const reasons: ContentLossReason[] = []
  const previousPages = previous?.pages
  const nextPages = next?.pages
  if (!previousPages || !nextPages) return reasons

  for (const [path, previousPage] of Object.entries(previousPages)) {
    const previousHtml = previousPage?.html || ''
    if (!previousHtml.trim()) continue

    const nextPage = nextPages[path]
    if (!nextPage || !(nextPage.html || '').trim()) {
      reasons.push({
        code: 'page_removed',
        page: path,
        message: `This deletes the ${pageLabel(path)}.`,
      })
      continue
    }
    const nextHtml = nextPage.html

    if (newlyBroken(previousHtml, nextHtml, 'design_missing_h1')) {
      reasons.push({
        code: 'lost_h1',
        page: path,
        message: `This removes the ${pageLabel(path)}'s main heading (its only <h1>), which breaks SEO and page structure.`,
      })
    }

    if (newlyBroken(previousHtml, nextHtml, 'design_missing_main_landmark')) {
      reasons.push({
        code: 'lost_main',
        page: path,
        message: `This removes the ${pageLabel(path)}'s <main> landmark, which screen readers rely on.`,
      })
    }

    // Floors keep this quiet on small pages; the 50% ratio means deleting one
    // paragraph, list item or image never trips it, but losing a section does.
    const previousText = textLength(previousHtml)
    const nextText = textLength(nextHtml)
    const previousElements = elementCount(previousHtml)
    const nextElements = elementCount(nextHtml)
    const textCollapsed = previousText >= 500 && nextText < previousText * 0.5
    const structureCollapsed = previousElements >= 20 && nextElements < previousElements * 0.5

    if (textCollapsed || structureCollapsed) {
      const percent = textCollapsed
        ? Math.round((1 - nextText / previousText) * 100)
        : Math.round((1 - nextElements / previousElements) * 100)
      reasons.push({
        code: 'content_shrank',
        page: path,
        message: `This removes about ${percent}% of the ${pageLabel(path)}'s content.`,
      })
    }
  }

  return reasons
}
