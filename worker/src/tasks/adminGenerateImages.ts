import type { Task } from 'graphile-worker'
import { generateAndUpload } from '@/lib/openai-images'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export type AdminGenerateImagesPayload = {
  /** Correlation id so the admin UI / caller can poll site_configs or a known key. */
  jobKey: string
  tenantId?: string
  slug: string
  heroImagePrompt?: string
  products?: Array<{ title?: string; imagePrompt?: string }>
}

/**
 * Admin batch image generation. Results are written to
 * site_configs.background_job when tenantId is set; otherwise only logged.
 */
export const adminGenerateImagesTask: Task = async (payload, helpers) => {
  const { jobKey, tenantId, slug, heroImagePrompt, products } =
    payload as AdminGenerateImagesPayload
  if (!jobKey || !slug) {
    throw new Error('admin_generate_images requires jobKey + slug')
  }

  const admin = getSupabaseAdmin()
  const mark = async (patch: Record<string, unknown>) => {
    if (!tenantId) return
    await admin
      .from('site_configs')
      .update({
        background_job: {
          task: 'admin_generate_images',
          jobKey,
          ...patch,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
  }

  await mark({ status: 'processing', started_at: new Date().toISOString() })

  try {
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

    ;(products || []).forEach((product, index) => {
      if (!product?.imagePrompt) return
      work.push(
        generateAndUpload(product.imagePrompt, slug, `product-${index + 1}`).then(
          (url) => {
            productResults.push({ index, title: product.title, image: url })
          }
        )
      )
    })

    await Promise.all(work)
    productResults.sort((a, b) => a.index - b.index)

    const result = {
      status: 'succeeded' as const,
      finished_at: new Date().toISOString(),
      slug,
      heroImage: heroResult.url ?? null,
      products: productResults.map(({ index, title, image }) => ({
        index,
        title,
        image,
      })),
    }
    await mark(result)
    helpers.logger.info(`admin_generate_images succeeded ${jobKey}`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await mark({
      status: 'failed',
      error: message,
      finished_at: new Date().toISOString(),
    })
    throw err
  }
}
