import {
  isAdminImageHttpsUrl,
  parseAdminImageDataUrl,
} from '@/lib/adminImageAttach'

export type HydratedAdminImages = {
  /** Persisted CDN https URLs the model must reuse in site HTML. */
  assetUrls: string[]
  /** Multimodal payloads for Claude/Gemini vision. */
  vision: Array<{ mimeType: string; data: string }>
}

const MAX_FETCH_BYTES = 4 * 1024 * 1024

function mimeFromContentType(ct: string | null, url: string): string | null {
  const base = (ct || '').split(';')[0].trim().toLowerCase()
  if (
    base === 'image/jpeg' ||
    base === 'image/png' ||
    base === 'image/webp' ||
    base === 'image/gif'
  ) {
    return base
  }
  if (/\.jpe?g(\?|$)/i.test(url)) return 'image/jpeg'
  if (/\.png(\?|$)/i.test(url)) return 'image/png'
  if (/\.webp(\?|$)/i.test(url)) return 'image/webp'
  if (/\.gif(\?|$)/i.test(url)) return 'image/gif'
  return null
}

async function fetchHttpsAsVision(
  url: string
): Promise<{ mimeType: string; data: string } | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      redirect: 'follow',
    })
    if (!res.ok) return null
    const mime = mimeFromContentType(res.headers.get('content-type'), url)
    if (!mime) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (!buf.length || buf.length > MAX_FETCH_BYTES) return null
    return { mimeType: mime, data: buf.toString('base64') }
  } catch (err) {
    console.warn('[hydrateAdminImages] fetch failed:', url, err)
    return null
  }
}

/**
 * Resolve admin image refs (CDN https URLs and/or legacy data URLs) into:
 * - assetUrls for the site builder prompt / mediaLibrary
 * - vision bytes for multimodal models
 */
export async function hydrateAdminImagesForModel(
  refs: string[] | undefined
): Promise<HydratedAdminImages> {
  const assetUrls: string[] = []
  const vision: HydratedAdminImages['vision'] = []
  const list = Array.isArray(refs) ? refs : []

  for (const ref of list.slice(0, 4)) {
    const parsed = parseAdminImageDataUrl(ref)
    if (parsed) {
      vision.push(parsed)
      continue
    }
    if (!isAdminImageHttpsUrl(ref)) continue
    assetUrls.push(ref.trim())
    const v = await fetchHttpsAsVision(ref.trim())
    if (v) vision.push(v)
  }

  return { assetUrls, vision }
}
