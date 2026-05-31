import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/admin'
import { checkAndIncrementAiUsage } from '@/lib/aiUsage'
import { generateAndUpload } from '@/lib/openai-images'

// gpt-image-1 renders take a while; give the function room. On a Vercel Hobby
// plan (60s hard cap) the client should fall back to one image per request.
export const maxDuration = 300
export const runtime = 'nodejs'

// Normalize an arbitrary slug/string into a storage-safe path segment.
function sanitizeSlug(value: string): string {
  return (value || 'site')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'site'
}

type ProductPromptInput = {
  title?: string
  imagePrompt?: string
}

export async function POST(req: Request) {
  try {
    // Admin-only: gpt-image-1 generation is expensive and writes to storage.
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const usage = await checkAndIncrementAiUsage('generate_images')
    if (!usage.allowed) {
      return NextResponse.json({ error: usage.reason || 'AI limit reached' }, { status: 429 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'Image generation is not configured (missing OPENAI_API_KEY).' },
        { status: 500 }
      )
    }

    const body = await req.json()
    const slug = sanitizeSlug(body.slug)
    const heroImagePrompt: string | undefined = body.heroImagePrompt
    const products: ProductPromptInput[] = Array.isArray(body.products) ? body.products : []

    if (!heroImagePrompt && products.every((p) => !p?.imagePrompt)) {
      return NextResponse.json(
        { error: 'No image prompts provided. Generate site content first.' },
        { status: 400 }
      )
    }

    // Generate hero + product images in parallel so the whole batch fits within
    // the function timeout. Each task uploads to site-assets/<slug>/<key>.png
    // and resolves to a permanent public URL.
    const heroResult: { url?: string } = {}
    const productResults: Array<{ index: number; title?: string; image: string }> = []

    const work: Promise<void>[] = []

    if (heroImagePrompt) {
      work.push(
        generateAndUpload(heroImagePrompt, slug, 'hero').then((url) => {
          heroResult.url = url
        })
      )
    }

    products.forEach((product, index) => {
      if (!product?.imagePrompt) return
      work.push(
        generateAndUpload(product.imagePrompt, slug, `product-${index + 1}`).then((url) => {
          productResults.push({ index, title: product.title, image: url })
        })
      )
    })

    await Promise.all(work)

    // Keep product order stable for the client (it maps back by index).
    productResults.sort((a, b) => a.index - b.index)

    return NextResponse.json({
      success: true,
      slug,
      heroImage: heroResult.url ?? null,
      products: productResults.map(({ index, title, image }) => ({ index, title, image })),
    })
  } catch (error) {
    console.error('Image Generation Error:', error)
    const { status, message } = describeImageError(error)
    return NextResponse.json({ error: message }, { status })
  }
}

// Map common OpenAI image-generation failures to clear, actionable messages so
// the operator knows whether it's an account/billing issue (fix in the OpenAI
// dashboard) versus a transient or code problem.
function describeImageError(error: unknown): { status: number; message: string } {
  const err = error as { status?: number; code?: string; message?: string }
  const code = err?.code
  const raw = err?.message || 'An error occurred during image generation.'

  if (code === 'billing_hard_limit_reached') {
    return {
      status: 402,
      message:
        'OpenAI billing hard limit reached. Raise the monthly usage limit (or add credit) for this OpenAI project before generating images.',
    }
  }
  if (code === 'insufficient_quota') {
    return {
      status: 402,
      message:
        'OpenAI quota exhausted. Add billing/credit to the OpenAI account, then retry image generation.',
    }
  }
  if (err?.status === 403) {
    return {
      status: 403,
      message:
        'OpenAI rejected gpt-image-1 (403). The organization likely needs verification to use gpt-image-1, or the API key lacks access.',
    }
  }
  if (err?.status === 429) {
    return {
      status: 429,
      message: 'OpenAI rate limit hit. Wait a moment and retry image generation.',
    }
  }
  return { status: 500, message: raw }
}
