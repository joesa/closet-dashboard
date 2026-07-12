import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { checkRateLimit, hashRateKey } from '@/lib/rateLimit'
import { enqueueProvisionJob } from '@/lib/provision/enqueueProvisionJob'
import { getIntakeByToken } from '@/lib/intake/getIntakeByToken'
import { buildIntakePublicJson } from '@/lib/intake/intakePublicResponse'
import { healIntakeTierFromPayments, effectiveIntakeTier } from '@/lib/intake/intakeTierGates'
import { kickProvisionAfterSubmit } from '@/lib/provision/kickProvisionAfterSubmit'
import { validateAiPremiumReady } from '@/lib/intake/buildAiProvisionPayload'
import { OTHER_SERVICE_LABEL } from '@/lib/catalog/contractorServices'
import { clampPagesForTier } from '@/lib/catalog/sitePages'
import { SITE_PAGE_SLUGS } from '@/lib/catalog/sitePages'
import { coerceThemeSlug, coerceLayoutSlug } from '@/lib/catalog/sitePresentationCatalog'
import { SURFACE_IDS, SHAPE_IDS, VOICE_IDS, SWATCH_IDS } from '@/lib/catalog/themeTokenPools'
import { decodeDataUrl } from '@/lib/images/decodeDataUrl'
import { uploadOptimizedBuffer } from '@/lib/images/uploadOptimized'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const row = await getIntakeByToken(token)

  if (!row) {
    return NextResponse.json({ error: 'Intake not found' }, { status: 404 })
  }
  if (row.status === 'archived') {
    return NextResponse.json({ error: 'This intake link is no longer active' }, { status: 410 })
  }

  const healed = await healIntakeTierFromPayments(row)

  return NextResponse.json(await buildIntakePublicJson(healed))
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await req.json()
    const supabase = getSupabaseAdmin()

    const submitLimit = await checkRateLimit(
      hashRateKey('intake_submit', token),
      3,
      60 * 60 * 1000
    )
    if (!submitLimit.allowed) {
      return NextResponse.json({ error: 'Too many submit attempts.' }, { status: 429 })
    }

    const existing = await getIntakeByToken(token)
    if (!existing) {
      return NextResponse.json({ error: 'Intake not found' }, { status: 404 })
    }
    const intakeRow = await healIntakeTierFromPayments(existing)
    const intakeTier = effectiveIntakeTier(intakeRow)
    if (existing.status === 'archived') {
      return NextResponse.json({ error: 'This intake link is no longer active' }, { status: 410 })
    }

    if (intakeRow.source === 'public' && !intakeRow.email_verified_at) {
      return NextResponse.json(
        {
          error:
            'Please verify your email using the link we sent before submitting this form.',
        },
        { status: 403 }
      )
    }

    const toStr = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
    const toArr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [])

    // Menu items (order-industry businesses only — see EngagementModel).
    // Sanitized here (not trusted from the client) the same way gallery/logo
    // uploads are validated below.
    const menuItems = (Array.isArray(body.menuItems) ? body.menuItems : [])
      .filter((item: unknown): item is Record<string, unknown> => !!item && typeof item === 'object')
      .slice(0, 100)
      .map((item: Record<string, unknown>) => ({
        name: typeof item.name === 'string' ? item.name.trim().slice(0, 200) : '',
        price:
          typeof item.price === 'number' && Number.isFinite(item.price) && item.price >= 0
            ? item.price
            : 0,
        category: typeof item.category === 'string' ? item.category.trim().slice(0, 80) || undefined : undefined,
      }))
      .filter((item: { name: string }) => item.name.length > 0)

    const services = toArr(body.services)
    const otherServices = toStr(body.otherServices)
    const hasOther = services.includes(OTHER_SERVICE_LABEL)

    if (hasOther) {
      if (!otherServices || otherServices.length < 1 || otherServices.length > 120) {
        return NextResponse.json(
          { error: 'Describe your other service (1–120 characters).' },
          { status: 400 }
        )
      }
    } else if (otherServices) {
      return NextResponse.json(
        { error: 'Select "Other" to add a custom service description.' },
        { status: 400 }
      )
    }

    const catalogServices = services.filter((s) => s !== OTHER_SERVICE_LABEL)
    if (catalogServices.length === 0 && !hasOther) {
      return NextResponse.json(
        { error: 'Select at least one service you offer.' },
        { status: 400 }
      )
    }

    if (intakeTier === 'ai_premium') {
      // Validate image selections against the services being submitted in this
      // request — not the (possibly stale/empty) services stored on the row.
      // The studio keys hero/product selections by the current form's service
      // labels; validating against the old row labels produced a false
      // "Select hero and product images before submitting" failure.
      const aiErr = validateAiPremiumReady({
        ...intakeRow,
        services,
        other_services: hasOther ? otherServices : null,
      })
      if (aiErr) {
        return NextResponse.json({ error: aiErr }, { status: 403 })
      }
    }

    // --- Gallery images ---
    // Each entry is either { dataUrl: string } or { url: string }.
    // data URLs are uploaded to storage; plain URLs are validated and kept as-is.
    const galleryUrls: string[] = []
    const rawGallery = Array.isArray(body.galleryImages) ? body.galleryImages : []
    for (let i = 0; i < rawGallery.length && i < 20; i++) {
      const entry = rawGallery[i]
      if (!entry || typeof entry !== 'object') continue
      if (typeof entry.dataUrl === 'string' && entry.dataUrl.startsWith('data:')) {
        const decoded = decodeDataUrl(entry.dataUrl)
        if (!decoded) continue
        if (decoded.buffer.byteLength > 10 * 1024 * 1024) continue // 10MB per image limit
        try {
          const publicUrl = await uploadOptimizedBuffer(
            decoded.buffer,
            `intakes/${token}/gallery/${i + 1}`,
            'gallery',
            decoded.mime
          )
          galleryUrls.push(publicUrl)
        } catch (err) {
          console.error('Gallery optimize/upload error for image', i + 1, err)
        }
      } else if (typeof entry.url === 'string') {
        try {
          const parsed = new URL(entry.url.trim())
          if (parsed.protocol === 'https:') galleryUrls.push(parsed.href)
        } catch {
          // Invalid URL — skip
        }
      }
    }

    let logoUrl: string | null = null
    if (typeof body.logoDataUrl === 'string' && body.logoDataUrl.startsWith('data:')) {
      const decoded = decodeDataUrl(body.logoDataUrl)
      if (!decoded) {
        return NextResponse.json({ error: 'Unsupported logo format' }, { status: 400 })
      }
      if (decoded.buffer.byteLength > 3 * 1024 * 1024) {
        return NextResponse.json({ error: 'Logo too large (max 3MB)' }, { status: 400 })
      }
      const publicUrl = await uploadOptimizedBuffer(
        decoded.buffer,
        `intakes/${token}/logo`,
        'logo',
        decoded.mime
      )
      logoUrl = publicUrl
    } else if (typeof body.logoUrl === 'string' && body.logoUrl.trim()) {
      try {
        const parsed = new URL(body.logoUrl.trim())
        if (parsed.protocol === 'https:') {
          logoUrl = parsed.href
        }
      } catch {
        // Ignore invalid URL, keep logo optional.
      }
    }

    const requestedProduct =
      body.requestedProduct === 'widget' || body.requestedProduct === 'full'
        ? body.requestedProduct
        : existing.requested_product

    const update: Record<string, unknown> = {
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      business_name: toStr(body.businessName),
      industry: toStr(body.industry),
      contact_name: toStr(body.contactName),
      contact_email: toStr(body.contactEmail),
      contact_phone: toStr(body.contactPhone),
      street_address: toStr(body.streetAddress),
      address_locality: toStr(body.addressLocality),
      address_region: toStr(body.addressRegion),
      postal_code: toStr(body.postalCode),
      service_area: toStr(body.serviceArea),
      notification_email: toStr(body.notificationEmail) || toStr(body.contactEmail),
      notification_phone: toStr(body.notificationPhone) || toStr(body.contactPhone),
      services,
      other_services: hasOther ? otherServices : null,
      widget_config_hints:
        body.widgetConfigHints && typeof body.widgetConfigHints === 'object'
          ? body.widgetConfigHints
          : existing.widget_config_hints,
      pricing_notes: toStr(body.pricingNotes),
      primary_color_hex: toStr(body.primaryColorHex),
      vibe: toStr(body.vibe),
      tone: toStr(body.tone),
      customers: toStr(body.customers),
      experience: toStr(body.experience),
      differentiators: toArr(body.differentiators),
      primary_cta: toStr(body.primaryCta),
      desired_domain: toStr(body.desiredDomain),
      domain_purchase_requested: body.domainPurchaseRequested === true,
      include_quiz: body.includeQuiz === true,
      notes: toStr(body.notes),
      requested_pages: clampPagesForTier(
        body.pages,
        intakeTier
      ),
      requested_product: requestedProduct,
      gallery_images: galleryUrls,
      menu_items: menuItems,
    }
    if (logoUrl) update.logo_url = logoUrl

    // --- User presentation override (from the review step) ---
    if (typeof body.themeOverride === 'string' && typeof body.layoutOverride === 'string') {
      const existingAiConfig = (intakeRow.ai_site_config ?? {}) as Record<string, unknown>
      const existingPres = (existingAiConfig.presentation ?? {}) as Record<string, unknown>
      // Only trust a client-supplied token selection if every ID is one of
      // the legal pool IDs — otherwise silently drop it (falls back to the
      // real named theme's authentic style instead of a bogus token combo).
      const rawTokens = body.themeTokensOverride as
        | { surface?: unknown; shape?: unknown; voice?: unknown; swatch?: unknown }
        | null
        | undefined
      const validTokens =
        rawTokens &&
        typeof rawTokens.surface === 'string' && SURFACE_IDS.includes(rawTokens.surface) &&
        typeof rawTokens.shape === 'string' && SHAPE_IDS.includes(rawTokens.shape) &&
        typeof rawTokens.voice === 'string' && VOICE_IDS.includes(rawTokens.voice) &&
        typeof rawTokens.swatch === 'string' && SWATCH_IDS.includes(rawTokens.swatch)
          ? {
              surface: rawTokens.surface,
              shape: rawTokens.shape,
              voice: rawTokens.voice,
              swatch: rawTokens.swatch,
            }
          : undefined

      update.ai_site_config = {
        ...existingAiConfig,
        presentation: {
          ...existingPres,
          theme: coerceThemeSlug(body.themeOverride),
          layoutStyle: coerceLayoutSlug(body.layoutOverride),
          themeTokens: validTokens,
          source: 'user',
          resolvedAt: new Date().toISOString(),
        },
      }
    }
    if (body.pageContents && typeof body.pageContents === 'object' && !Array.isArray(body.pageContents)) {
      // Accept the standard catalog pages plus any AI-suggested / custom pages
      // the prospect actually selected (persisted above in requested_pages).
      const validSlugs = new Set([
        ...SITE_PAGE_SLUGS,
        ...(Array.isArray(update.requested_pages) ? (update.requested_pages as string[]) : []),
      ])
      const sanitized: Record<string, string> = {}
      for (const [slug, raw] of Object.entries(body.pageContents)) {
        if (!validSlugs.has(slug)) continue
        if (typeof raw !== 'string') continue
        const text = (raw as string).trim()
        if (!text) continue
        const wordCount = text.split(/\s+/).filter(Boolean).length
        if (wordCount > 1200) {
          return NextResponse.json(
            { error: `Page "${slug}" exceeds the 1,200-word limit (${wordCount} words).` },
            { status: 400 }
          )
        }
        sanitized[slug] = text
      }
      update.page_contents = sanitized
    }

    const { error: updateErr } = await supabase
      .from('prospect_intakes')
      .update(update)
      .eq('id', intakeRow.id)

    if (updateErr) throw updateErr

    // AI-Premium always auto-deploys the initial build: the AI picks theme/
    // layout, builds the full content, the validator repairs it, and provisioning
    // deploys a gated `pending_approval` site — no admin hand-off for the first
    // deploy. The admin still reviews that gated build and can edit + redeploy.
    // A 'manual' provisioning_mode is only honored for non-AI-Premium tiers.
    const provisionMode =
      intakeTier === 'ai_premium'
        ? 'auto'
        : intakeRow.provisioning_mode === 'manual'
          ? 'manual'
          : 'auto'
    let provisionQueued = false

    if (provisionMode === 'auto') {
      let jobMode: 'full' | 'widget' | 'ai_full' =
        requestedProduct === 'widget' ? 'widget' : 'full'
      if (intakeTier === 'ai_premium' && requestedProduct !== 'widget') {
        jobMode = 'ai_full'
      }
      try {
        const enqueue = await enqueueProvisionJob(intakeRow.id, jobMode)
        provisionQueued = enqueue.queued
        if (enqueue.queued && !enqueue.duplicate) {
          kickProvisionAfterSubmit(intakeRow.id)
        } else if (enqueue.duplicate && enqueue.status === 'pending') {
          kickProvisionAfterSubmit(intakeRow.id)
        }
      } catch (enqueueErr) {
        // Intake data is saved — log the enqueue failure but don't surface a 500
        // to the user. An admin can manually re-queue from the dashboard.
        console.error('enqueueProvisionJob failed (intake saved):', enqueueErr)
      }
    }

    return NextResponse.json({
      success: true,
      provisionQueued,
      manualBuild: provisionMode === 'manual',
    })
  } catch (error) {
    console.error('Intake submit error:', error)
    const message = error instanceof Error ? error.message : 'Failed to submit intake'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
