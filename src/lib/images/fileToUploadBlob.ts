/**
 * Client-only: downscale a user photo to a JPEG Blob small enough for Vercel's
 * ~4.5MB request body limit (JSON data URLs of phone photos routinely exceed it).
 */
export async function fileToUploadJpegBlob(
  file: File,
  opts?: { maxDim?: number; quality?: number }
): Promise<Blob> {
  const maxDim = opts?.maxDim ?? 1920
  const quality = opts?.quality ?? 0.85
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not process image')
    ctx.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Could not encode image'))),
        'image/jpeg',
        quality
      )
    })
    return blob
  } finally {
    bitmap.close()
  }
}
