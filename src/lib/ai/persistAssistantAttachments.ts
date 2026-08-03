/**
 * Persist AI Site Assistant image attachments to the public site-assets
 * bucket so they can be referenced from live site_configs fields.
 */

import { persistImageUrl } from '@/lib/images/uploadOptimized'
import {
  isAdminImageHttpsUrl,
  parseAdminImageDataUrl,
} from '@/lib/adminImageAttach'

export type AssistantAsset = {
  /** 1-based index matching "[attached image #N]" in the transcript. */
  index: number
  url: string
  /** True when we uploaded a data URL this turn (vs already a CDN https URL). */
  uploaded: boolean
}

function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
}

/**
 * Upload data-URL attachments (and pass through https CDN URLs) under
 * `assistant/<tenantId>/…`. Returns assets in the same order as `refs`,
 * 1-indexed for prompt tags.
 */
export async function persistAssistantAttachments(
  tenantId: string,
  refs: string[]
): Promise<AssistantAsset[]> {
  const out: AssistantAsset[] = []
  const base = stamp()

  for (let i = 0; i < refs.length; i++) {
    const ref = (refs[i] || '').trim()
    if (!ref) continue
    const index = i + 1

    if (isAdminImageHttpsUrl(ref)) {
      out.push({ index, url: ref, uploaded: false })
      continue
    }

    const parsed = parseAdminImageDataUrl(ref)
    if (!parsed) continue

    const path = `assistant/${tenantId}/${base}-${index}`
    try {
      const url = await persistImageUrl(ref, path, 'hero')
      if (url && /^https:\/\//i.test(url)) {
        out.push({ index, url, uploaded: true })
      }
    } catch (err) {
      console.warn(
        `[persistAssistantAttachments] upload #${index} failed:`,
        err instanceof Error ? err.message : err
      )
    }
  }

  return out
}

/** Heuristic: admin wants the attachment(s) placed on the site, not just reviewed. */
export function adminWantsAttachmentsOnSite(message: string): boolean {
  const t = message || ''
  // Explicit "don't use / just a screenshot" wins.
  if (
    /\b(just|only)\s+(a\s+)?(screenshot|reference|example)\b/i.test(t) ||
    /\b(don'?t|do not|dont)\s+(use|upload|add|put|set|place)\b/i.test(t) ||
    /\bfor\s+reference\s+only\b/i.test(t)
  ) {
    return false
  }
  return (
    /\b(use|set|put|place|add|replace|upload|make|feature|show|display|insert|embed|publish)\b[\s\S]{0,100}\b(hero|banner|background|image|photo|picture|logo|before|after|service|product|gallery|portfolio|page|site|website|section|card)\b/i.test(
      t
    ) ||
    /\b(hero|banner|background|logo|before|after|gallery|portfolio|service|product|page|section|card)\b[\s\S]{0,80}\b(image|photo|picture|pic|file|this|these|attached|uploaded)\b/i.test(
      t
    ) ||
    /\b(this|these|the|attached|uploaded)\s+(image|photo|picture|pic|file|attachment)s?\b[\s\S]{0,80}\b(as|for|on|onto|in|inside|to)\b[\s\S]{0,60}\b(hero|banner|background|logo|before|after|gallery|portfolio|service|product|page|site|website|section|card)\b/i.test(
      t
    ) ||
    /\b(use|feature|show|display|insert|embed|publish)\s+(this|these|it|them)\b/i.test(t) ||
    /\bmake\s+(this|these|it|them)\s+(the|my|our|a|an)\s+(hero|banner|background|logo|before|after|gallery|portfolio|service|product)\b/i.test(t)
  )
}
