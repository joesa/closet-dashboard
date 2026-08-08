/**
 * Client-only: downscale a user photo to a JPEG Blob small enough for Vercel's
 * ~4.5MB request body limit (JSON data URLs of phone photos routinely exceed it).
 */
export async function fileToUploadJpegBlob(
  file: File,
  opts?: { maxDim?: number; quality?: number; maxBytes?: number }
): Promise<Blob> {
  const maxDim = opts?.maxDim ?? 1920
  const quality = opts?.quality ?? 0.85
  const maxBytes = opts?.maxBytes
  const bitmap = await createImageBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not process image')

    let scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    const qualities = [quality, Math.min(quality, 0.88), 0.82, 0.76]

    for (let resizeAttempt = 0; resizeAttempt < 4; resizeAttempt += 1) {
      const width = Math.max(1, Math.round(bitmap.width * scale))
      const height = Math.max(1, Math.round(bitmap.height * scale))
      canvas.width = width
      canvas.height = height
      ctx.drawImage(bitmap, 0, 0, width, height)

      for (const encodeQuality of qualities) {
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (result) =>
              result ? resolve(result) : reject(new Error('Could not encode image')),
            'image/jpeg',
            encodeQuality
          )
        })
        if (!maxBytes || blob.size <= maxBytes) return blob
      }

      scale *= 0.85
    }

    throw new Error('Could not compress image under the upload limit')
  } finally {
    bitmap.close()
  }
}
