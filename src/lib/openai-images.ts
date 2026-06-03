import OpenAI from 'openai'
import { getSupabaseAdmin } from './supabase-admin'

/**
 * Bespoke image generation helpers.
 *
 * The onboarding image pipeline renders art-directed landscape images with
 * OpenAI's `gpt-image-1` model and stores them in the public `site-assets`
 * Supabase Storage bucket so custom-closets-websites can serve them via
 * next/image.
 *
 * Server-only: gpt-image-1 + the service-role storage client must never run in
 * the browser.
 */

const SITE_ASSETS_BUCKET = 'site-assets'

// gpt-image-1 supports 1024x1024, 1024x1536 (portrait), 1536x1024 (landscape)
// and 'auto'. 1536x1024 is the wide landscape format we want for hero +
// product shots. (dall-e-3's 1792x1024 is NOT valid for this model.)
const LANDSCAPE_SIZE = '1536x1024'

// Domain + quality guardrail appended to every prompt. Keeps even vague,
// hand-edited prompts anchored to custom-closet/home-storage subjects with a
// premium photographic look and the right negative cues. Applied idempotently
// so AI-generated prompts that already carry these cues are not doubled up.
const DOMAIN_ANCHOR =
  'Subject is a real, organized residential custom-closet / home-storage installation ' +
  '(cabinetry, shelving, drawers, hanging rods, pantry, garage, or mudroom) — never a server ' +
  'room, office, data center, lab, or any unrelated tech subject.'
const QUALITY_SUFFIX =
  'Authentic real-estate / architectural interior photograph, shot on a full-frame DSLR with a ' +
  '24-35mm lens at f/8, natural window light with soft realistic shadows and accurate color ' +
  'temperature. Real physical materials with natural grain, subtle wear, and lived-in imperfections. ' +
  'Photorealistic, 8k, crisp focus, shallow realistic depth of field, wide 16:9 composition. ' +
  'NOT a 3D render, NOT CGI, not digital art, not an illustration — avoid plastic/glossy surfaces, ' +
  'waxy textures, warped geometry, uncanny perfect symmetry, fake reflections, and over-saturation. ' +
  'No text, no people, no logos, no watermarks.'

function enrichImagePrompt(prompt: string): string {
  const trimmed = prompt.trim()
  const lower = trimmed.toLowerCase()
  const parts: string[] = [trimmed]
  if (
    !lower.includes('closet') &&
    !lower.includes('storage') &&
    !lower.includes('cabinetry') &&
    !lower.includes('pantry') &&
    !lower.includes('wardrobe') &&
    !lower.includes('mudroom') &&
    !lower.includes('garage')
  ) {
    parts.push(DOMAIN_ANCHOR)
  }
  if (!lower.includes('photorealistic') || !lower.includes('no people')) {
    parts.push(QUALITY_SUFFIX)
  } else if (!lower.includes('not cgi') && !lower.includes('not a 3d render')) {
    // Prompt is already photographic but lacks the anti-AI realism guardrail —
    // append the realism cues so output looks like a real photo, not a render.
    parts.push(
      'Authentic real photograph, shot on a full-frame DSLR, natural light, real materials with ' +
        'subtle imperfections. NOT a 3D render, NOT CGI, not digital art — avoid plastic surfaces, ' +
        'waxy textures, and uncanny perfect symmetry.'
    )
  }
  return parts.join(' ')
}

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
 * Render a single image from a prompt with gpt-image-1. This model always
 * returns base64 data (no `response_format`/`style` params), so the result
 * decodes straight to a Buffer for upload. `quality: 'high'` keeps the
 * architectural photos crisp and photorealistic.
 */
export async function generateImage(prompt: string): Promise<Buffer> {
  const openai = getOpenAI()
  const result = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: enrichImagePrompt(prompt),
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
