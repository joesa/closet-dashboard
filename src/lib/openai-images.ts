import OpenAI, { toFile } from 'openai'
import { getSupabaseAdmin } from './supabase-admin'
import type { IndustrySlug } from './catalog/types'

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
  const modelCandidates =
    configured.length > 0
      ? configured
      : [
          'imagen-4.0-generate-001',
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
  const modelCandidates =
    configured.length > 0
      ? configured
      : [
          'imagen-4.0-generate-001',
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
 * Space-type keywords mapped to a human-readable label used in the "before"
 * prompt so the messy scene feels like the same room as the "after" image.
 * Only consulted for the 'interior-space' before/after category.
 */
const SPACE_TYPE_MAP: Array<{ keywords: string[]; label: string }> = [
  { keywords: ['wine', 'cellar', 'bottle'], label: 'wine cellar' },
  { keywords: ['pantry', 'kitchen'], label: 'kitchen pantry' },
  { keywords: ['garage', 'workshop'], label: 'garage' },
  { keywords: ['mudroom', 'entryway'], label: 'mudroom' },
  { keywords: ['office', 'executive', 'desk'], label: 'home office' },
  { keywords: ['library', 'book'], label: 'home library' },
  { keywords: ['laundry', 'utility'], label: 'laundry room' },
  { keywords: ['entertainment', 'media', 'theater'], label: 'media room' },
  { keywords: ['kids', 'playful', 'playroom'], label: "kids' room" },
  { keywords: ['dressing', 'wardrobe', 'walk-in', 'walkin'], label: 'walk-in closet' },
]

function inferSpaceType(afterImageUrl: string): string {
  const lower = afterImageUrl.toLowerCase()
  for (const { keywords, label } of SPACE_TYPE_MAP) {
    if (keywords.some((kw) => lower.includes(kw))) return label
  }
  return 'storage space' // generic fallback
}

/**
 * Broad subject category for a business's before/after transformation. The
 * "before" scene must depict the SAME kind of subject as the after image —
 * just worse — never an unrelated messy interior for a business whose actual
 * work is on vehicles, exteriors, or fixtures. (e.g. a car-wrapping shop's
 * "before" must be a dull, unwrapped car — not a garage full of boxes.)
 */
export type BeforeAfterCategory = 'vehicle' | 'exterior' | 'fixture' | 'pet' | 'interior-space' | 'not-applicable'

// Free-text keywords that strongly signal the vehicle category regardless of
// which industry slug the business resolved to (industries like
// "Signage & Vehicle Wraps" bundle both vehicle wraps and building signage,
// so the industry slug alone isn't a reliable enough signal).
const VEHICLE_TEXT_KEYWORDS = [
  'wrap', 'detailing', 'detail', 'tint', 'ppf', 'paint protection', 'ceramic coat',
  'car ', 'auto', 'vehicle', 'truck', 'van', 'fleet', 'boat', 'marine', 'rv ', 'motorcycle',
]

/**
 * Industry slug -> before/after subject category. This is `Record<IndustrySlug, ...>`
 * (NOT `Record<string, ...>`) *on purpose* — TypeScript will fail the build if a
 * new industry is ever added to the catalog (src/lib/catalog/types.ts's
 * `IndustrySlug` union) without an explicit entry here. This is the exact class
 * of bug that shipped 'pet-services' silently falling back to the generic
 * messy-room prompt (nonsensical when the reference photo is a dog): a
 * `Record<string, ...>` partial map compiles fine even when an industry is
 * missing, and the omission is invisible until someone notices the wrong image.
 * See `getBeforeAfterCategory()` below and `openai-images.test.ts`'s exhaustive
 * catalog-coverage test for a second, human-readable guard against this
 * drifting back to a partial map.
 *
 * `'not-applicable'` (added 2026-07-04): a "before/after transformation" photo
 * slider only makes narrative sense for a business that takes something from
 * a run-down/unfinished physical state to a refined one (an old car's paint
 * job -> a new one; a cluttered closet -> an organized one). It does NOT make
 * sense for direct-purchase/order businesses (a restaurant doesn't have a
 * "before" meal), pure professional/knowledge services (legal, financial,
 * consulting, IT, research, insurance, real estate — there's no physical
 * object the business transforms), ticketed/booking businesses (hotels,
 * tours, museums, theaters, amusement parks — nothing is "renovated" for the
 * customer), or medical/personal-care services where an actual before/after
 * would mean showing a real person's body/face looking "worse" (fitness,
 * personal training, massage, therapy, senior care, medical clinics — the
 * same likeness/identity concern that already excludes beauty-salon below).
 * `provisionTenant.ts` skips generating a before/after image AND the
 * renderer (`custom-closets-websites/ClientPage.tsx`) omits the before/after
 * section entirely when this category is set.
 */
const INDUSTRY_BEFORE_AFTER_CATEGORY: Record<IndustrySlug, BeforeAfterCategory> = {
  // Vehicle — same vehicle, dull/unfinished vs. finished
  'mobile-auto': 'vehicle',
  'auto-body': 'vehicle',
  'signage-wraps': 'vehicle',
  'limo-shuttle': 'vehicle',
  'hotshot-trucking': 'vehicle',
  'rv-boat-service': 'vehicle',
  'food-truck': 'vehicle',
  'towing': 'vehicle',
  'courier-delivery': 'vehicle',
  'medical-transport': 'vehicle',
  // Exterior — same yard/home exterior, neglected vs. maintained
  'landscaping': 'exterior',
  'roofing': 'exterior',
  'pressure-washing': 'exterior',
  'tree-service': 'exterior',
  'painting': 'exterior',
  'concrete-masonry': 'exterior',
  'pool-spa': 'exterior',
  'garage-door': 'exterior',
  'gutters': 'exterior',
  'irrigation': 'exterior',
  'solar': 'exterior',
  'windows-doors': 'exterior',
  'waterproofing': 'exterior',
  'foundation-repair': 'exterior',
  'siding': 'exterior',
  'fencing': 'exterior',
  'snow-removal': 'exterior',
  'outdoor-lighting': 'exterior',
  'deck-maintenance': 'exterior',
  'parking-lot': 'exterior',
  'pest-control': 'exterior',
  'drone-services': 'exterior',
  'bounce-house': 'exterior',
  // Fixture / equipment — same fixture, old & worn vs. new
  'plumbing': 'fixture',
  'hvac': 'fixture',
  'electrical': 'fixture',
  'appliance-repair': 'fixture',
  'locksmith': 'fixture',
  'chimney-fireplace': 'fixture',
  'security-systems': 'fixture',
  'generator-services': 'fixture',
  'countertops': 'fixture',
  'cabinet-painting': 'fixture',
  'epoxy-flooring': 'fixture',
  'septic-services': 'fixture',
  'well-services': 'fixture',
  'water-treatment': 'fixture',
  'glass-mirror': 'fixture',
  'blinds-shutters': 'fixture',
  'duct-cleaning': 'fixture',
  'fire-protection': 'fixture',
  'commercial-refrigeration': 'fixture',
  'restaurant-equipment': 'fixture',
  'welding-fabrication': 'fixture',
  'elevator-services': 'fixture',
  'it-computer-repair': 'fixture',
  'carpentry': 'fixture',
  'flooring': 'fixture',
  'drywall': 'fixture',
  'insulation': 'fixture',
  'tile-grout-cleaning': 'fixture',
  // Pet — same animal, dirty/unkempt vs. clean & groomed
  'pet-services': 'pet',
  // Interior space — same room, cluttered/damaged/unfinished vs. finished.
  // Includes the original closet/storage use case, whole-room remodels, and
  // service businesses with no natural single-object "before" prop (personal
  // services, admin/paperwork, entertainment booking) where a generic room
  // scene is the least-wrong default.
  'custom-closets': 'interior-space',
  'cleaning': 'interior-space',
  'handyman': 'interior-space',
  'moving': 'interior-space',
  'junk-removal': 'interior-space',
  'home-inspection': 'interior-space',
  'bathroom-remodel': 'interior-space',
  'kitchen-remodel': 'interior-space',
  'mold-remediation': 'interior-space',
  'fire-restoration': 'interior-space',
  'mobile-notary': 'not-applicable',
  'personal-training': 'not-applicable',
  'massage-therapy': 'not-applicable',
  'tutoring': 'not-applicable',
  'catering-chef': 'not-applicable',
  'photography-video': 'not-applicable',
  'home-staging': 'interior-space',
  'event-rentals': 'interior-space',
  'dj-entertainment': 'not-applicable',
  // Fourth-wave industries — most are booking/ticketed or pure professional
  // services with no physical "before" prop, so 'not-applicable' correctly
  // skips before/after entirely (see the docstring above). A few genuinely
  // have a legit facility/venue transformation narrative and keep
  // 'interior-space' (event-planning, spa-wellness, laundry-services). Human
  // beauty/grooming (hair, nails, tattoos) is deliberately NOT given a
  // before/after treatment of the CLIENT'S body/face — editing a real
  // person's photo to look "worse" raises likeness/identity concerns that
  // don't apply to a pet or a car, so beauty-salon (and the same-reasoning
  // fitness-studio/personal-training/massage-therapy above) are
  // 'not-applicable' rather than substituting a facility photo.
  'hotel-lodging': 'not-applicable',
  'restaurants-bars': 'not-applicable',
  'tourism-travel': 'not-applicable',
  'event-planning': 'interior-space',
  'recreation-entertainment': 'not-applicable',
  'arts-culture': 'not-applicable',
  'legal-services': 'not-applicable',
  'financial-professionals': 'not-applicable',
  'business-consulting': 'not-applicable',
  'marketing-advertising': 'not-applicable',
  'it-services': 'not-applicable',
  'architecture-engineering': 'not-applicable',
  'research-services': 'not-applicable',
  'beauty-salon': 'not-applicable',
  'spa-wellness': 'interior-space',
  'fitness-studio': 'not-applicable',
  'life-services': 'not-applicable',
  'laundry-services': 'interior-space',
  'medical-clinic': 'not-applicable',
  'therapy-rehab': 'not-applicable',
  'senior-care': 'not-applicable',
  'education-formal': 'not-applicable',
  'enrichment-education': 'not-applicable',
  'banking-lending': 'not-applicable',
  'investment-services': 'not-applicable',
  'insurance-services': 'not-applicable',
  'real-estate-services': 'not-applicable',
  // Vehicle/exterior for the fourth-wave logistics industries.
  'passenger-transport': 'vehicle',
  'freight-logistics': 'vehicle',
  'waste-management': 'exterior',
}

/**
 * Public getter for INDUSTRY_BEFORE_AFTER_CATEGORY. Exists mainly so tests
 * (and any other caller) can verify every catalog industry resolves to a
 * category without reaching into a module-private table.
 */
export function getBeforeAfterCategory(slug: IndustrySlug): BeforeAfterCategory {
  return INDUSTRY_BEFORE_AFTER_CATEGORY[slug]
}

/** Vehicle noun to use in the before-prompt, inferred from free-text hints. */
function inferVehicleNoun(text: string): string {
  if (text.includes('boat') || text.includes('marine')) return 'boat'
  if (text.includes('rv')) return 'RV'
  if (text.includes('food truck')) return 'food truck'
  if (text.includes('truck') || text.includes('fleet')) return 'pickup truck'
  if (text.includes('van')) return 'cargo van'
  if (text.includes('motorcycle')) return 'motorcycle'
  return 'car'
}

/** Exterior feature noun to use in the before-prompt, inferred from free-text hints. */
function inferExteriorNoun(text: string): string {
  if (text.includes('roof')) return "a home's roof"
  if (text.includes('pool') || text.includes('spa')) return 'a backyard pool area'
  if (text.includes('driveway') || text.includes('concrete') || text.includes('parking')) return 'a concrete driveway'
  if (text.includes('deck')) return 'a backyard deck'
  if (text.includes('fence')) return 'a yard fence'
  if (text.includes('gutter')) return "a home's gutters and roofline"
  if (text.includes('garage door')) return 'a home garage door and driveway'
  if (text.includes('siding')) return "a home's exterior siding"
  if (text.includes('window') || text.includes('door')) return "a home's exterior windows"
  if (text.includes('lawn') || text.includes('landscap') || text.includes('yard') || text.includes('tree')) return 'a front yard and lawn'
  if (text.includes('drone') || text.includes('aerial')) return "an aerial view of a property"
  if (text.includes('bounce') || text.includes('inflatable')) return 'a backyard party setup'
  if (text.includes('pest') || text.includes('termite') || text.includes('rodent')) return "a home's exterior perimeter"
  return 'the exterior of a home'
}

/** Pet/animal noun to use in the before-prompt, inferred from free-text hints. */
function inferPetNoun(text: string): string {
  if (text.includes('cat')) return 'cat'
  if (text.includes('horse') || text.includes('equine')) return 'horse'
  return 'dog'
}

/** Fixture/equipment noun to use in the before-prompt, inferred from free-text hints. */
function inferFixtureNoun(text: string): string {
  if (text.includes('plumb') || text.includes('pipe') || text.includes('water heater')) return 'exposed plumbing pipes and a water heater'
  if (text.includes('hvac') || text.includes('furnace') || text.includes('air condition')) return 'an HVAC furnace and ductwork unit'
  if (text.includes('electric') || text.includes('panel') || text.includes('wiring')) return 'an electrical breaker panel and wiring'
  if (text.includes('lock') || text.includes('door hardware')) return 'a door lock and handle set'
  if (text.includes('chimney') || text.includes('fireplace')) return 'a fireplace and chimney'
  if (text.includes('security') || text.includes('camera') || text.includes('alarm')) return 'a home security panel'
  if (text.includes('counter')) return 'a kitchen countertop'
  if (text.includes('cabinet')) return 'kitchen cabinetry'
  if (text.includes('floor') || text.includes('epoxy')) return 'a garage floor'
  if (text.includes('glass') || text.includes('mirror') || text.includes('window')) return 'a window and glass pane'
  if (text.includes('blind') || text.includes('shutter')) return 'window blinds'
  if (text.includes('generator')) return 'a backup power generator'
  if (text.includes('refriger') || text.includes('restaurant equipment')) return 'a commercial refrigeration unit'
  if (text.includes('computer') || text.includes('it ') || text.includes('laptop')) return 'a computer and its internal hardware'
  if (text.includes('drywall')) return 'a section of drywall wall'
  if (text.includes('insulation') || text.includes('attic')) return 'attic insulation'
  if (text.includes('tile') || text.includes('grout')) return 'a tiled floor and grout lines'
  if (text.includes('carpentry') || text.includes('trim') || text.includes('molding') || text.includes('built-in')) return 'custom trim and built-in carpentry'
  if (text.includes('floor')) return 'a hardwood floor'
  return 'a mechanical fixture'
}

/**
 * Classify the before/after subject category from whatever industry context
 * is available. Falls back to 'interior-space' (the original room/closet
 * behavior) when nothing more specific is known — this preserves behavior
 * for callers that don't pass any context.
 */
function classifyBeforeAfterSubject(context?: {
  industry?: string | null
  services?: string[] | null
  otherServices?: string | null
  /**
   * Category from a matching contractor-created custom industry (see
   * @/lib/catalog/customIndustries) — takes precedence over every other
   * signal below when present, since it's an explicit, validated answer
   * rather than a guess from free text.
   */
  beforeAfterCategoryOverride?: BeforeAfterCategory | null
}): { category: BeforeAfterCategory; text: string } {
  const text = [context?.industry, ...(context?.services ?? []), context?.otherServices]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .join(' ')
    .toLowerCase()

  if (context?.beforeAfterCategoryOverride) {
    return { category: context.beforeAfterCategoryOverride, text }
  }

  if (VEHICLE_TEXT_KEYWORDS.some((kw) => text.includes(kw))) {
    return { category: 'vehicle', text }
  }

  const industrySlugGuess = (context?.industry || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  // industrySlugGuess is a best-effort reconstruction from free text, not
  // guaranteed to be a real IndustrySlug — INDUSTRY_BEFORE_AFTER_CATEGORY is
  // deliberately typed as exhaustive over the real union (see its docstring),
  // so an unrecognized guess is looked up via a safe cast and simply falls
  // through to the 'interior-space' default below, same as before.
  const category = INDUSTRY_BEFORE_AFTER_CATEGORY[industrySlugGuess as IndustrySlug]
  return { category: category || 'interior-space', text }
}

/**
 * Generate a contextually-matched "before" image for a site's before/after
 * transformation slider. Rather than generating an unrelated new scene, this
 * edits the actual "after" image (image-to-image, `input_fidelity: 'high'`)
 * so the "before" shot depicts the EXACT SAME subject — same vehicle, same
 * room, same fixture, same framing — just in its worse-off, pre-service
 * state. This avoids the slider ever comparing two different objects (e.g. a
 * Honda "before" next to a Mercedes "after").
 *
 * The image is uploaded to `site-assets/<slug>/before.png` and the permanent
 * public URL is returned. Throws if OpenAI is unavailable — callers should
 * `.catch(() => null)` so provisioning never fails over a before image.
 */
export async function generateBeforeImage(
  afterImageUrl: string,
  slug: string,
  context?: {
    industry?: string | null
    services?: string[] | null
    otherServices?: string | null
    beforeAfterCategoryOverride?: BeforeAfterCategory | null
  }
): Promise<string> {
  const { category, text } = classifyBeforeAfterSubject(context)

  let prompt: string

  if (category === 'vehicle') {
    const vehicle = inferVehicleNoun(text)
    prompt =
      `This is the finished "AFTER" photo of a ${vehicle} detailing job. Transform it into the "BEFORE" photo ` +
      `of the SAME ${vehicle} in the SAME pose, angle, framing, and background. You MUST visibly degrade the ` +
      `paint condition — this is the whole point of the edit: strip away all gloss and reflections, make the ` +
      `paint look dull, hazy, and faded with heavy swirl marks, water spots, and road grime/dust film across ` +
      `every panel. Remove any wrap, ceramic coating, or graphics. The wheels should look dirty with visible ` +
      `brake dust. Do not leave the vehicle looking clean, shiny, or freshly detailed — it must clearly look ` +
      `neglected and due for service. Keep the same vehicle model, color, and composition. Realistic ` +
      `automotive photograph. No people, no text, no logos, no branding.`
  } else if (category === 'exterior') {
    const feature = inferExteriorNoun(text)
    prompt =
      `This is the finished "AFTER" photo showing a completed job on ${feature}. Transform it into the ` +
      `"BEFORE" photo of the SAME scene, structure, angle, and framing. You MUST visibly degrade the ` +
      `condition — this is the whole point of the edit: add overgrown weeds, faded and peeling paint or ` +
      `stain, cracked and stained surfaces, discoloration, moss/grime buildup, and general disrepair. Do not ` +
      `leave it looking clean, maintained, or freshly finished — it must clearly look neglected and overdue ` +
      `for the work this business does. Keep the same structure and composition. Realistic exterior ` +
      `photograph. No people, no text, no logos.`
  } else if (category === 'fixture') {
    const fixture = inferFixtureNoun(text)
    prompt =
      `This is the finished "AFTER" photo showing a completed job on ${fixture}. Transform it into the ` +
      `"BEFORE" photo of the SAME fixture, angle, and framing. You MUST visibly degrade the condition — ` +
      `this is the whole point of the edit: make it look visibly outdated, corroded, rusted, or damaged, ` +
      `with dust and grime built up and signs of age. Do not leave it looking new, clean, or freshly ` +
      `installed — it must clearly look old and neglected. Keep the same fixture and composition. Realistic ` +
      `close-up photograph. No people, no text, no logos.`
  } else if (category === 'pet') {
    const animal = inferPetNoun(text)
    prompt =
      `This is the finished "AFTER" photo of a freshly groomed ${animal} — clean, brushed, trimmed coat, ` +
      `and happy. Transform it into the "BEFORE" photo of the EXACT SAME ${animal} (same breed, coloring, ` +
      `size, and markings) in the SAME pose, angle, framing, and background/setting. You MUST visibly ` +
      `degrade its groomed condition — this is the whole point of the edit: make the coat look dirty, ` +
      `matted, tangled, and unevenly overgrown, with visible mud/grime stains, tear stains, and a generally ` +
      `scruffy, unkempt appearance. Do not leave the ${animal} looking clean, brushed, or freshly groomed — ` +
      `it must clearly look like it badly needs a grooming appointment. Keep the SAME individual animal, ` +
      `pose, and composition — do not change species, breed, or scene. Realistic pet photograph. No people, ` +
      `no text, no logos.`
  } else {
    const spaceType = inferSpaceType(afterImageUrl)
    prompt =
      `This is the finished "AFTER" photo of a custom ${spaceType} installation. Transform it into the ` +
      `"BEFORE" photo of the SAME room, dimensions, layout, and camera angle. You MUST replace the ` +
      `organized custom cabinetry/built-ins entirely — this is the whole point of the edit: show cheap wire ` +
      `shelving sagging under random junk, cardboard moving boxes stacked haphazardly with flaps open, loose ` +
      `items scattered on the floor, bare drywall with scuff marks and water stains, and a single harsh ` +
      `bare-bulb overhead light. Do not leave any organized storage, built-ins, or finished cabinetry visible — ` +
      `it must clearly look cramped, dim, and completely disorganized. Keep the same room shape and camera ` +
      `angle. Realistic interior photograph. No people, no text, no logos.`
  }

  const referenceBuffer = await fetchImageBuffer(afterImageUrl)
  const buffer = await generateImageEditWithProvider(referenceBuffer, prompt, 'landscape')
  return uploadSiteAsset(buffer, slug, 'before')
}

