import { generateAndUpload } from '@/lib/openai-images'

export function describeImageError(error: unknown): { status: number; message: string } {
  const err = error as { status?: number; code?: string; message?: string }
  const code = err?.code
  const raw = err?.message || 'An error occurred during image generation.'

  if (code === 'billing_hard_limit_reached') {
    return {
      status: 402,
      message:
        'OpenAI billing hard limit reached. Raise the limit in the OpenAI dashboard.',
    }
  }
  if (code === 'insufficient_quota') {
    return {
      status: 402,
      message: 'OpenAI quota exhausted. Add billing/credit and retry.',
    }
  }
  if (err?.status === 403) {
    return {
      status: 403,
      message: 'OpenAI rejected gpt-image-1 (403). Verify org access for this model.',
    }
  }
  if (err?.status === 429) {
    return { status: 429, message: 'OpenAI rate limit hit. Wait and retry.' }
  }
  return { status: 500, message: raw }
}

/** Generate `count` variants (default 3) and upload under storagePrefix. */
export async function generateImageVariants(
  prompt: string,
  storagePrefix: string,
  keyPrefix: string,
  count = 3
): Promise<string[]> {
  const urls: string[] = []
  await Promise.all(
    Array.from({ length: count }, (_, i) =>
      generateAndUpload(prompt, storagePrefix, `${keyPrefix}-${i + 1}`).then((url) => {
        urls[i] = url
      })
    )
  )
  return urls.filter(Boolean)
}
