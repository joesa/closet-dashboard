import { generateAndUpload } from '@/lib/openai-images'

export type BriefServiceImageJob = {
  title: string
  description?: string
}

export type BriefServiceImageResult = {
  title: string
  url: string
  note: string
}

function slugKey(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'service'
  )
}

/** Photorealistic prompt for a brief-added service (not in original intake). */
export function briefServiceImagePrompt(
  brandName: string,
  title: string,
  description?: string
): string {
  const detail =
    typeof description === 'string' && description.trim()
      ? description.trim().slice(0, 160)
      : `Professional ${title} work for a local service business`
  return (
    `Professional photograph of real ${title} work in progress or just finished for "${brandName}". ` +
    `${detail}. Shot on a full-frame DSLR with a 35mm lens in natural daylight, ` +
    `authentic tools, materials, and finished results visible, subtle imperfections, ` +
    `photorealistic, 8k, wide 16:9 composition, NOT a 3D render, NOT CGI, not digital art, ` +
    `no plastic surfaces, no text, no logos, no watermarks.`
  )
}

/**
 * Generate one CDN image per brief-added service and upload under
 * site-assets/custom/<tenantId>/. Failures are skipped (partial success OK).
 */
export async function generateBriefServiceImages(opts: {
  tenantId: string
  brandName: string
  services: BriefServiceImageJob[]
  /** Cap to protect Full redesign time budget. */
  max?: number
}): Promise<BriefServiceImageResult[]> {
  const max = Math.max(1, Math.min(opts.max ?? 8, 12))
  const jobs = opts.services.slice(0, max)
  if (!jobs.length) return []

  const storagePrefix = `custom/${opts.tenantId}`
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

  const settled = await Promise.allSettled(
    jobs.map(async (svc, i) => {
      const title = svc.title.trim()
      if (!title) throw new Error('empty title')
      const key = `brief-${slugKey(title)}-${stamp}-${i + 1}`
      const prompt = briefServiceImagePrompt(opts.brandName, title, svc.description)
      const url = await generateAndUpload(prompt, storagePrefix, key)
      const note =
        `AI-generated image for brief-added service “${title}” (not in original intake). ` +
        `CDN: ${url}`
      return { title, url, note } satisfies BriefServiceImageResult
    })
  )

  const out: BriefServiceImageResult[] = []
  for (const r of settled) {
    if (r.status === 'fulfilled') out.push(r.value)
    else console.warn('[generateBriefServiceImages] failed:', r.reason)
  }
  return out
}
