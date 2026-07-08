import OpenAI, { toFile } from 'openai'
import { getSupabaseAdmin } from './supabase-admin'
import {
  buildBeforeImagePrompt,
  type BeforeAfterContext,
} from '@/lib/images/beforeAfterPrompt'

// Re-exported so existing imports of the category map keep working; the
// implementation lives in the client-safe beforeAfterPrompt module now.
export {
  getBeforeAfterCategory,
  classifyBeforeAfterSubject,
  buildBeforeImagePrompt,
  type BeforeAfterCategory,
} from '@/lib/images/beforeAfterPrompt'

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
const SQUARE_SIZE = '1024x1024'

// Domain + quality guardrail appended to every prompt. Keeps even vague,
// hand-edited prompts anchored to the business's actual trade with a premium
// photographic look and the right negative cues, without assuming any specific
// industry. Applied idempotently so prompts that already carry the cue are not
// doubled up.
const DOMAIN_ANCHOR =
  'Subject is the real, on-the-job work of the business — its finished installations or completed ' +
  'work, crews, tools, equipment, and the actual spaces it services for its trade — never a server ' +
  'room, data center, lab, spaceship, or any unrelated abstract-tech subject.'

const QUALITY_SUFFIX_INTERIOR =
  'Authentic real-world interior photograph, shot on a full-frame DSLR with a ' +
  '24-35mm lens at f/8, natural window light with soft realistic shadows and accurate color ' +
  'temperature. Real physical materials with natural grain, subtle wear, and lived-in imperfections. ' +
  'Photorealistic, 8k, crisp focus, shallow realistic depth of field, wide 16:9 composition. ' +
  'NOT a 3D render, NOT CGI, not digital art, not an illustration — avoid plastic/glossy surfaces, ' +
  'waxy textures, warped geometry, uncanny perfect symmetry, fake reflections, and over-saturation. ' +
  'No text, no logos, no watermarks.'

const QUALITY_SUFFIX_EXTERIOR =
  'Authentic real-world outdoor / exterior photograph, shot on a full-frame DSLR with a ' +
  '24-35mm lens at f/8, natural daylight with realistic sun/shade shadows and accurate color ' +
  'temperature. Real physical materials with natural textures, subtle wear, and lived-in imperfections. ' +
  'Photorealistic, 8k, crisp focus, realistic depth of field, wide 16:9 composition. ' +
  'NOT a 3D render, NOT CGI, not digital art, not an illustration — avoid plastic/glossy surfaces, ' +
  'waxy textures, warped geometry, uncanny perfect symmetry, fake reflections, and over-saturation. ' +
  'No text, no logos, no watermarks.'

function isExteriorPrompt(prompt: string): boolean {
  const lower = prompt.toLowerCase()
  const exteriorKeywords = [
    'exterior', 'outdoor', 'outside', 'roof', 'yard', 'lawn', 'landscap',
    'tree', 'pool', 'deck', 'driveway', 'siding', 'gutter', 'street',
    'vehicle', 'truck', 'car ', 'boat', 'aerial', 'building facade',
    'siding', 'fence', 'fencing', 'painting exterior', 'power washing',
    'pressure washing', 'concrete pouring', 'masonry'
  ]
  return exteriorKeywords.some(kw => lower.includes(kw))
}

function enrichImagePrompt(prompt: string): string {
  const trimmed = prompt.trim()
  const lower = trimmed.toLowerCase()
  const parts: string[] = [trimmed]
  if (!lower.includes('on-the-job') && !lower.includes('unrelated abstract-tech')) {
    parts.push(DOMAIN_ANCHOR)
  }

  const isExt = isExteriorPrompt(trimmed)
  const qualitySuffix = isExt ? QUALITY_SUFFIX_EXTERIOR : QUALITY_SUFFIX_INTERIOR

  if (!lower.includes('photorealistic')) {
    parts.push(qualitySuffix)
  } else if (!lower.includes('not cgi') && !lower.includes('not a 3d render')) {
    // Prompt is already photographic but lacks the anti-AI realism guardrail —
    // append the realism cues so output looks like a real photo, not a render.
    parts.push(
      isExt
        ? 'Authentic real outdoor photograph, shot on a full-frame DSLR, natural daylight, real materials with ' +
          'subtle imperfections. NOT a 3D render, NOT CGI, not digital art — avoid plastic surfaces, ' +
          'waxy textures, and uncanny perfect symmetry.'
        : 'Authentic real indoor photograph, shot on a full-frame DSLR, natural light, real materials with ' +
          'subtle imperfections. NOT a 3D render, NOT CGI, not digital art — avoid plastic surfaces, ' +
          'waxy textures, and uncanny perfect symmetry.'
    )
  }
  return parts.join(' ')
}

type ImageShape = 'landscape' | 'square'

function imageSize(shape: ImageShape): string {
  return shape === 'square' ? SQUARE_SIZE : LANDSCAPE_SIZE
}

function shapePromptPrefix(shape: ImageShape): string {
  return shape === 'square'
    ? 'Square 1:1 composition, centered subject, balanced margins. '
    : ''
}

function parseAnyError(error: unknown): {
  status?: number
  code?: string
  message?: string
} {
  if (error && typeof error === 'object') {
    const e = error as {
      status?: number
      code?: string
      message?: string
      error?: { code?: string; message?: string; status?: number }
    }
    return {
      status: e.status ?? e.error?.status,
      code: e.code ?? e.error?.code,
      message: e.message ?? e.error?.message,
    }
  }
  return {}
}

function isOpenAIQuotaLike(error: unknown): boolean {
  const e = parseAnyError(error)
  const msg = (e.message || '').toLowerCase()
  return (
    e.code === 'billing_hard_limit_reached' ||
    e.code === 'insufficient_quota' ||
    msg.includes('billing_hard_limit_reached') ||
    msg.includes('insufficient_quota') ||
    (e.status === 429 && (msg.includes('quota') || msg.includes('billing') || msg.includes('rate limit')))
  )
}

async function generateImageWithGemini(prompt: string, shape: ImageShape): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY for fallback image generation')
  }

  const configured = (process.env.GEMINI_IMAGE_MODELS || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean)
  // NOTE: Imagen models (imagen-*) are only served via the `:predict` endpoint
  // and 404 on `:generateContent`. The models below are the image-capable
  // Gemini models that DO support `:generateContent` with an IMAGE modality.
  const modelCandidates =
    configured.length > 0
      ? configured
      : [
          'gemini-2.5-flash-image',
          'gemini-2.0-flash-preview-image-generation',
        ]

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: `${shapePromptPrefix(shape)}${enrichImagePrompt(prompt)}` }],
      },
    ],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  }

  let lastStatus = 500
  let lastMessage = 'Gemini image generation failed'

  for (const model of modelCandidates) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    )

    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg =
        (json && typeof json === 'object' && (json as { error?: { message?: string } }).error?.message) ||
        `Gemini image generation failed (${res.status})`
      lastStatus = res.status
      lastMessage = `${model}: ${msg}`
      continue
    }

    const candidates = Array.isArray((json as { candidates?: unknown[] }).candidates)
      ? ((json as { candidates: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }> }).candidates)
      : []

    for (const candidate of candidates) {
      const parts = candidate.content?.parts ?? []
      for (const part of parts) {
        const b64 = part.inlineData?.data
        if (b64) {
          return Buffer.from(b64, 'base64')
        }
      }
    }

    lastStatus = 502
    lastMessage = `${model}: Gemini returned no image data`
  }

  throw Object.assign(new Error(lastMessage), {
    status: lastStatus,
    code: 'gemini_image_error',
  })
}

async function generateImageWithOpenAI(prompt: string, shape: ImageShape): Promise<Buffer> {
  const openai = getOpenAI()
  const result = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: `${shapePromptPrefix(shape)}${enrichImagePrompt(prompt)}`,
    n: 1,
    size: imageSize(shape),
    quality: 'high',
  })

  const b64 = result.data?.[0]?.b64_json
  if (!b64) {
    throw new Error('gpt-image-1 returned no image data')
  }
  return Buffer.from(b64, 'base64')
}

async function generateImageWithProvider(prompt: string, shape: ImageShape): Promise<Buffer> {
  if (process.env.GEMINI_API_KEY) {
    try {
      return await generateImageWithGemini(prompt, shape)
    } catch (error) {
      console.warn('Gemini image generation failed, falling back to OpenAI:', error)
      if (process.env.OPENAI_API_KEY) {
        try {
          return await generateImageWithOpenAI(prompt, shape)
        } catch (openAiError) {
          console.error('OpenAI fallback image generation also failed:', openAiError)
          throw openAiError
        }
      }
      throw error
    }
  }

  if (process.env.OPENAI_API_KEY) {
    return generateImageWithOpenAI(prompt, shape)
  }

  throw new Error('Missing OPENAI_API_KEY and GEMINI_API_KEY')
}

/** Download a reference image (one of our own site-assets) into a Buffer for image-to-image editing. */
async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch reference image for editing (${res.status})`)
  }
  const arrayBuffer = await res.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * Edit an existing image with gpt-image-1 instead of generating a brand-new
 * one. Used for the before/after slider's "before" shot so it depicts the
 * SAME subject as the "after" photo (same vehicle, same room, same fixture)
 * just in a worse-off state — `input_fidelity: 'high'` tells the model to
 * preserve the subject, angle and composition as closely as possible.
 */
async function generateImageEditWithOpenAI(
  imageBuffer: Buffer,
  prompt: string,
  shape: ImageShape
): Promise<Buffer> {
  const openai = getOpenAI()
  const file = await toFile(imageBuffer, 'reference.png', { type: 'image/png' })
  const result = await openai.images.edit({
    model: 'gpt-image-1',
    image: file,
    prompt: `${shapePromptPrefix(shape)}${enrichImagePrompt(prompt)}`,
    size: imageSize(shape) as '1024x1024' | '1536x1024' | '1024x1536',
    quality: 'high',
    // NOTE: 'high' input_fidelity makes gpt-image-1 over-preserve the source
    // image (it will barely apply the requested "worse condition" edit at
    // all — testing showed a near-identical copy of the after photo). 'low'
    // gives the model enough freedom to actually degrade the condition while
    // the prompt's explicit "same vehicle/room/angle" instructions keep the
    // subject consistent.
    input_fidelity: 'low',
  })

  const b64 = result.data?.[0]?.b64_json
  if (!b64) {
    throw new Error('gpt-image-1 edit returned no image data')
  }
  return Buffer.from(b64, 'base64')
}

/** Gemini fallback for image-to-image editing, mirroring generateImageWithGemini's model-candidate loop. */
async function generateImageEditWithGemini(
  imageBuffer: Buffer,
  prompt: string,
  shape: ImageShape
): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY for fallback image editing')
  }

  const configured = (process.env.GEMINI_IMAGE_MODELS || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean)
  // NOTE: Imagen models (imagen-*) are only served via the `:predict` endpoint
  // and 404 on `:generateContent`. The models below are the image-capable
  // Gemini models that DO support `:generateContent` with an IMAGE modality.
  const modelCandidates =
    configured.length > 0
      ? configured
      : [
          'gemini-2.5-flash-image',
          'gemini-2.0-flash-preview-image-generation',
        ]

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/png', data: imageBuffer.toString('base64') } },
          { text: `${shapePromptPrefix(shape)}${enrichImagePrompt(prompt)}` },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  }

  let lastStatus = 500
  let lastMessage = 'Gemini image editing failed'

  for (const model of modelCandidates) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    )

    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg =
        (json && typeof json === 'object' && (json as { error?: { message?: string } }).error?.message) ||
        `Gemini image editing failed (${res.status})`
      lastStatus = res.status
      lastMessage = `${model}: ${msg}`
      continue
    }

    const candidates = Array.isArray((json as { candidates?: unknown[] }).candidates)
      ? ((json as { candidates: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }> }).candidates)
      : []

    for (const candidate of candidates) {
      const parts = candidate.content?.parts ?? []
      for (const part of parts) {
        const b64 = part.inlineData?.data
        if (b64) {
          return Buffer.from(b64, 'base64')
        }
      }
    }

    lastStatus = 502
    lastMessage = `${model}: Gemini returned no image data`
  }

  throw Object.assign(new Error(lastMessage), {
    status: lastStatus,
    code: 'gemini_image_error',
  })
}

async function generateImageEditWithProvider(
  imageBuffer: Buffer,
  prompt: string,
  shape: ImageShape
): Promise<Buffer> {
  if (process.env.GEMINI_API_KEY) {
    try {
      return await generateImageEditWithGemini(imageBuffer, prompt, shape)
    } catch (error) {
      console.warn('Gemini image edit failed, falling back to OpenAI:', error)
      if (process.env.OPENAI_API_KEY) {
        try {
          return await generateImageEditWithOpenAI(imageBuffer, prompt, shape)
        } catch (openAiError) {
          console.error('OpenAI fallback image edit also failed:', openAiError)
          throw openAiError
        }
      }
      throw error
    }
  }

  if (process.env.OPENAI_API_KEY) {
    return generateImageEditWithOpenAI(imageBuffer, prompt, shape)
  }

  throw new Error('Missing OPENAI_API_KEY and GEMINI_API_KEY')
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
  return generateImageWithProvider(prompt, 'landscape')
}

/** Generate a square image (used by logo generation) with provider fallback. */
export async function generateSquareImage(prompt: string): Promise<Buffer> {
  return generateImageWithProvider(prompt, 'square')
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

// ---------------------------------------------------------------------------
// Before-image generation
// ---------------------------------------------------------------------------

/**
 * Image-to-image edit of a hosted reference image: fetches the reference,
 * applies the prompt via the provider chain (Gemini first, OpenAI fallback),
 * uploads the result to `site-assets/<slug>/<key>.png`, and returns the
 * permanent public URL. Used by the intake studio's before/after generator
 * and by `generateBeforeImage` below.
 */
export async function editImageFromUrl(
  referenceUrl: string,
  prompt: string,
  slug: string,
  key: string
): Promise<string> {
  const referenceBuffer = await fetchImageBuffer(referenceUrl)
  const buffer = await generateImageEditWithProvider(referenceBuffer, prompt, 'landscape')
  return uploadSiteAsset(buffer, slug, key)
}

/**
 * Generate a contextually-matched "before" image for a site's before/after
 * transformation slider. Rather than generating an unrelated new scene, this
 * edits the actual "after" image (image-to-image) so the "before" shot
 * depicts the EXACT SAME subject — same vehicle, same room, same fixture,
 * same framing — just in its worse-off, pre-service state. This avoids the
 * slider ever comparing two different objects (e.g. a Honda "before" next to
 * a Mercedes "after").
 *
 * The image is uploaded to `site-assets/<slug>/before.png` and the permanent
 * public URL is returned. Throws if OpenAI is unavailable — callers should
 * `.catch(() => null)` so provisioning never fails over a before image.
 */
export async function generateBeforeImage(
  afterImageUrl: string,
  slug: string,
  context?: BeforeAfterContext
): Promise<string> {
  const prompt = buildBeforeImagePrompt(afterImageUrl, context)
  return editImageFromUrl(afterImageUrl, prompt, slug, 'before')
}

