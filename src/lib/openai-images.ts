import OpenAI from 'openai'
import { getSupabaseAdmin } from './supabase-admin'

/**
 * Bespoke image generation helpers.
 *
 * The onboarding image pipeline renders art-directed 16:9 images with OpenAI's
 * gpt-image-1 model and stores them in the public `site-assets` Supabase Storage
 * bucket so custom-closets-websites can serve them via next/image.
 *
 * Server-only: gpt-image-1 + the service-role storage client must never run in
 * the browser.
 */

const SITE_ASSETS_BUCKET = 'site-assets'

// gpt-image-1 supports 1024x1024, 1024x1536 (portrait) and 1536x1024
// (landscape). 1536x1024 is the true 16:9-ish wide format we want for hero +
// product shots. "8k" in the prompt is an aesthetic cue, not the real output.
const LANDSCAPE_SIZE = '1536x1024'

let _client: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (typeof window !== 'undefined') {
    throw new Error('openai-images must never be used in the browser')
  }
  if (_client) return _client
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY')
  }
  _client = new OpenAI({ apiKey })
  return _client
}

/**
 * Render a single image from a prompt with gpt-image-1. gpt-image-1 always
 * returns base64 (there is no temporary URL to download), so we decode straight
 * to a Buffer for upload.
 */
export async function generateImage(prompt: string): Promise<Buffer> {
  const openai = getOpenAI()
  const result = await openai.images.generate({
    model: 'gpt-image-1',
    prompt,
    n: 1,
    size: LANDSCAPE_SIZE,
    quality: 'high',
  })

  const b64 = result.data?.[0]?.b64_json
  if (!b64) {
    throw new Error('gpt-image-1 returned no image data')
  }
  return Buffer.from(b64, 'base64')
}

/**
 * Upload an image buffer to the public `site-assets` bucket under
 * `<slug>/<key>.png` and return its permanent public URL. `upsert` lets the
 * operator regenerate a build's images without colliding on the same path.
 */
export async function uploadSiteAsset(
  buffer: Buffer,
  slug: string,
  key: string
): Promise<string> {
  const supabase = getSupabaseAdmin()
  const filePath = `${slug}/${key}.png`

  const { error } = await supabase.storage
    .from(SITE_ASSETS_BUCKET)
    .upload(filePath, buffer, {
      contentType: 'image/png',
      upsert: true,
    })

  if (error) throw error

  const { data } = supabase.storage.from(SITE_ASSETS_BUCKET).getPublicUrl(filePath)
  return data.publicUrl
}

/**
 * Generate an image from a prompt and upload it in one step, returning the
 * permanent public URL.
 */
export async function generateAndUpload(
  prompt: string,
  slug: string,
  key: string
): Promise<string> {
  const buffer = await generateImage(prompt)
  return uploadSiteAsset(buffer, slug, key)
}
