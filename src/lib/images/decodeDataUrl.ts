export type DecodedDataUrl = {
  ext: string
  mime: string
  buffer: Buffer
}

/** Parse a `data:image/...;base64,...` URL without regex on the payload. */
export function decodeDataUrl(dataUrl: string): DecodedDataUrl | null {
  const commaIdx = dataUrl.indexOf(',')
  if (commaIdx === -1) return null
  const header = dataUrl.slice(0, commaIdx)
  const b64 = dataUrl.slice(commaIdx + 1)
  if (!b64) return null

  const headerMatch = /^data:(image\/(png|jpeg|jpg|webp|svg\+xml));base64$/i.exec(header)
  if (!headerMatch) return null

  const mime = headerMatch[1]
  const extMap: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  }
  return {
    ext: extMap[mime.toLowerCase()] || 'png',
    mime,
    buffer: Buffer.from(b64, 'base64'),
  }
}

export function isDataImageUrl(value: string): boolean {
  return value.startsWith('data:image/')
}
