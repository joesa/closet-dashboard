/**
 * Shared helpers for admin UI image attachments (Custom Build + Site Chat).
 * Client-only — uses canvas / createImageBitmap.
 */

export const MAX_ADMIN_IMAGE_ATTACHMENTS = 4

/**
 * Downscale an image file to a chat/generate-friendly data URL. Screenshots
 * are often 4–8MB PNGs; resizing to ≤1600px JPEG keeps the request small
 * without losing the detail the model needs.
 */
export async function fileToAdminImageDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const maxDim = 1600
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process image')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.85)
}

/** Parse a data URL into provider-ready mime + base64 (no data: prefix). */
export function parseAdminImageDataUrl(
  url: string
): { mimeType: string; data: string } | null {
  const m =
    /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)$/i.exec(
      url.trim()
    )
  if (!m) return null
  const mimeType = m[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : m[1].toLowerCase()
  return { mimeType, data: m[2] }
}

/**
 * Normalize an untrusted `images` array from an admin API body into at most
 * MAX_ADMIN_IMAGE_ATTACHMENTS valid data URLs.
 */
export function normalizeAdminImageDataUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (out.length >= MAX_ADMIN_IMAGE_ATTACHMENTS) break
    if (typeof item !== 'string') continue
    if (!parseAdminImageDataUrl(item)) continue
    out.push(item)
  }
  return out
}
