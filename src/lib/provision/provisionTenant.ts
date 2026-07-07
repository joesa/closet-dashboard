import { v4 as uuidv4 } from 'uuid'
import { Resend } from 'resend'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { widgetEmbedSnippet } from '@/lib/urls'
import { normalizeDomain, attachVercelDomain } from '@/lib/vercel-domains'
import {
  parseImageSelections,
  syncProductSlots,
} from '@/lib/intake/imageSelections'
import { persistImageSelections } from '@/lib/images/persistImageSelections'
import { generateBeforeImage, getBeforeAfterCategory } from '@/lib/openai-images'
import { provisionServiceLabels } from '@/lib/intake/provisionServiceLabels'
import {
  clampPagesForTier,
  maxAdditionalPagesForTier,
  buildBasicPagesConfig,
  injectGalleryImagesIntoPages,
  type BasicPageConfig,
} from '@/lib/catalog/sitePages'
import {
  type ProvisionTenantInput,
  type ProvisionTenantResult,
  ProvisionReviewError,
} from '@/lib/provision/types'
import { resolveDesignSeed } from '@/lib/provision/resolveDesignSeed'
import { isForcedPreset } from '@/lib/catalog/designVariantCatalog'
import { syncTenantLaunchAccess } from '@/lib/intake/syncTenantLaunchAccess'
import { MINIMAL_LAYOUTS_WITHOUT_ANCHOR_SECTIONS } from '@/lib/catalog/sitePresentationCatalog'
import { validateTenantSite, saveValidationReport } from '@/lib/validation/siteValidator'
import {
  INDUSTRY_CONFIGS,
  getIndustry,
  resolveIndustrySlug,
} from '@/lib/catalog/serviceCatalog'
import { getEngineProfile } from '@/lib/catalog/engineProfiles'
import type { IndustrySlug } from '@/lib/catalog/types'
import {
  DEFAULT_DOMAIN_CONFIG,
  ROOM_TYPES,
} from '@/lib/rooms'

const DEFAULT_DISABLED_ROOMS = [...ROOM_TYPES]

function inferWidgetDomainConfig(services: string[] | null | undefined) {
  if (!services || services.length === 0) return null
  const industrySlug = resolveIndustrySlug({ services })
  const industry = INDUSTRY_CONFIGS[industrySlug]
  return {
    ...DEFAULT_DOMAIN_CONFIG,
    categoryLabel: industry?.categoryLabel || DEFAULT_DOMAIN_CONFIG.categoryLabel,
    unitLabel: industry?.unitLabel || DEFAULT_DOMAIN_CONFIG.unitLabel,
    unitAbbrev: industry?.unitAbbrev || DEFAULT_DOMAIN_CONFIG.unitAbbrev,
    tierLabel: industry?.tierLabel || DEFAULT_DOMAIN_CONFIG.tierLabel,
    pricingModel: industry?.pricingModel || DEFAULT_DOMAIN_CONFIG.pricingModel,
    unitMin: industry?.unitMin || DEFAULT_DOMAIN_CONFIG.unitMin,
    unitMax: industry?.unitMax || DEFAULT_DOMAIN_CONFIG.unitMax,
    baseFee: industry?.baseFee || DEFAULT_DOMAIN_CONFIG.baseFee,
  }
}

function inferDisabledDefaultRooms(services: string[] | null | undefined): string[] {
  if (!services || services.length === 0) return DEFAULT_DISABLED_ROOMS
  const offered = new Set(services)
  return ROOM_TYPES.filter((room) => !offered.has(room))
}

type CustomRoomInput = { name: string; basic?: number; standard?: number; premium?: number }

type TierDefaults = { basic: number; standard: number; premium: number }

// Sensible starting prices for a business's industry, sourced from the engine
// profile's serviceDefaults priceHints (engineProfiles.ts). Used whenever no
// AI/user-supplied pricing is available so the quote/booking/ticket/order
// calculator never ships all-$0 tiers. Falls back to generic trade prices when
// a profile omits a given tier.
function getEngineTierDefaults(slug: IndustrySlug): TierDefaults {
  const tiers = getEngineProfile(slug)?.serviceDefaults?.[0]?.tiers ?? []
  const hintFor = (tier: 'basic' | 'standard' | 'premium') =>
    tiers.find((t) => t.tier === tier)?.priceHint
  const standard = hintFor('standard') ?? tiers[0]?.priceHint ?? 65
  const basic = hintFor('basic') ?? Math.max(1, Math.round(standard * 0.7))
  const premium = hintFor('premium') ?? Math.round(standard * 1.6)
  return { basic, standard, premium }
}

// A room is effectively unpriced when every tier is missing or 0. (A flat_tiered
// room legitimately has basic=0 but a non-zero standard/premium, so we only
// treat the room as unpriced when the whole thing sums to 0.)
function roomIsUnpriced(room: CustomRoomInput): boolean {
  return (
    (Number(room.basic) || 0) +
      (Number(room.standard) || 0) +
      (Number(room.premium) || 0) ===
    0
  )
}

// The admin's "Services Offered" checkboxes (or, for a prospect intake, the
// customer's own selected services) are the authoritative list of what the
// business actually sells. The AI widget generation only sees a snapshot of
// that list at generation time — if the admin later checks additional
// services (or the AI simply omitted some), the quote calculator would
// otherwise silently only offer whatever the AI happened to generate. Add a
// room for every selected service that's missing, so the calculator always
// matches the selected services list.
function mergeCustomRoomsWithServices(
  customRooms: CustomRoomInput[],
  services: string[] | null | undefined,
  engineDefaults: TierDefaults
): CustomRoomInput[] {
  // Prefer the average of whatever pricing the AI already generated so newly
  // added services stay in the same ballpark; if nothing is priced yet, fall
  // back to the industry's engine-profile defaults so we never seed all-$0.
  const avg = (key: 'basic' | 'standard' | 'premium') => {
    const values = customRooms
      .map((r) => r[key])
      .filter((v): v is number => typeof v === 'number' && v > 0)
    if (values.length === 0) return engineDefaults[key]
    return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length)
  }
  const defaults: TierDefaults = {
    basic: avg('basic'),
    standard: avg('standard'),
    premium: avg('premium'),
  }

  const existingNames = new Set(customRooms.map((r) => r.name.toLowerCase().trim()))
  const missing = (services || []).filter(
    (s) => s.trim() && !existingNames.has(s.toLowerCase().trim())
  )

  // Backfill sensible prices onto any AI/user room that came through entirely
  // unpriced (the root cause of the all-$0 calculator), then append rooms for
  // every selected service the AI never generated.
  const priced = customRooms.map((r) =>
    roomIsUnpriced(r) ? { ...r, ...defaults } : r
  )

  return [...priced, ...missing.map((name) => ({ name, ...defaults }))]
}

function isMissingDesignVariantColumn(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: string; message?: string; details?: string }
  const msg = `${e.message || ''} ${e.details || ''}`.toLowerCase()
  return e.code === 'PGRST204' || msg.includes('design_variant')
}

function generateTempPassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

export async function provisionTenant(
  body: ProvisionTenantInput
): Promise<ProvisionTenantResult> {
  const {
    businessName,
    theme,
    layoutStyle,
    themeTokens,
    beforeAfterCategoryOverride,
    engagementModel,
    menuItems,
    designVariant,
    subdomain,
    ownerEmail,
    heroHeadline,
    aboutDescription,
    heroImage,
    beforeImage,
    services,
    aiSiteConfig,
    aiWidgetConfig,
    intakeSetup,
    intakeId,
    loginOrigin,
    sendWelcomeEmail = true,
  } = body

  const setup = intakeSetup || {}
  // Industry/services context for before-image generation so the AI "before"
  // scene matches the business's actual subject (vehicle, exterior, fixture,
  // or interior space) instead of always assuming a messy storage room.
  //
  // Resolve via the same services->industry catalog matching used everywhere
  // else in provisioning (resolveIndustrySlug), rather than relying solely on
  // aiWidgetConfig.industry — that field is only ever set by the manual AI
  // "Generate" button in the admin sandbox tool, so for prospects loaded from
  // a real intake (or any flow that skips that button) it's undefined and
  // before-image generation was silently falling back to the generic
  // interior/closet scene even for e.g. a roofing business.
  const aiWidgetIndustryText =
    typeof (aiWidgetConfig as Record<string, unknown> | null)?.industry === 'string'
      ? ((aiWidgetConfig as Record<string, unknown>).industry as string)
      : setup.industry
  const beforeAfterContext = {
    industry: resolveIndustrySlug({ industry: aiWidgetIndustryText, services }),
    services,
    // Explicit override from a matching contractor-created custom industry
    // (see resolveSitePresentation.ts) takes precedence over the static
    // slug-guess classification in openai-images.ts.
    beforeAfterCategoryOverride: beforeAfterCategoryOverride || undefined,
  }

  const resolvedEngagementModel = engagementModel || (aiSiteConfig?.engagementModel as string) || getIndustry(beforeAfterContext.industry)?.engagementModel || 'quote';
  const isOrderBusiness = resolvedEngagementModel === 'order';
  const isBookingBusiness = resolvedEngagementModel === 'booking';
  const isTicketBusiness = resolvedEngagementModel === 'ticket';

  // We explicitly log to let us trace tenant creation in edge logs.
  // Some businesses have no physical "before" state at all (order/direct-
  // purchase businesses, pure professional services, ticketed/booking
  // businesses, or anything centered on a person's body/face) — see the
  // BeforeAfterCategory docstring in openai-images.ts. Skip generating AND
  // rendering the before/after slider entirely for these, rather than
  // showing a nonsensical or ethically-questionable image.
  const beforeAfterApplicable =
    (beforeAfterCategoryOverride || getBeforeAfterCategory(beforeAfterContext.industry)) !== 'not-applicable'
  const mode: 'full' | 'widget' = body.mode === 'widget' ? 'widget' : 'full'
  const isWidgetOnly = mode === 'widget'

  const missingRequired = isWidgetOnly
    ? !businessName || !ownerEmail
    : !businessName || !theme || !subdomain || !ownerEmail
  if (missingRequired) {
    throw new Error('Missing required fields')
  }

  const supabase = getSupabaseAdmin()

  const { data: existingTenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('owner_email', ownerEmail)
    .maybeSingle()
  if (existingTenant) {
    // Tear down the previous tenant so the admin can redeploy cleanly.
    const oldId = existingTenant.id
    await supabase.from('site_configs').delete().eq('tenant_id', oldId)
    await supabase.from('domains').delete().eq('tenant_id', oldId)
    await supabase.from('contractor_rooms').delete().eq('contractor_id', oldId)
    await supabase.from('contractor_addons').delete().eq('contractor_id', oldId)
    await supabase.from('contractor_finishes').delete().eq('contractor_id', oldId)
    await supabase.from('contractor_settings').delete().eq('id', oldId)
    await supabase.from('tenants').delete().eq('id', oldId)
    console.log(`Redeploy: tore down previous tenant ${oldId} for ${ownerEmail}`)
  }

  const tenantId = body.tenantId || uuidv4()
  const widgetId = tenantId

  const siteStatus =
    body.siteStatus ??
    (isWidgetOnly ? 'widget_only' : 'pending_approval')

  const settingsRow: Record<string, unknown> = {
    id: tenantId,
    company_name: businessName,
    contact_email: ownerEmail,
  }
  const leadEmail = setup.notificationEmail || setup.contactEmail
  const leadPhone = setup.notificationPhone || setup.contactPhone
  if (leadEmail) settingsRow.contact_email = leadEmail
  if (leadPhone) settingsRow.contact_phone = leadPhone
  if (setup.primaryColorHex) settingsRow.primary_color_hex = setup.primaryColorHex

  const inferredDomainConfig = inferWidgetDomainConfig(services)
  if (inferredDomainConfig) {
    settingsRow.domain_config = inferredDomainConfig
  }

  const { error: settingsError } = await supabase
    .from('contractor_settings')
    .upsert(settingsRow)
  if (settingsError) throw settingsError

  const { error: tenantError } = await supabase.from('tenants').insert({
    id: tenantId,
    business_name: businessName,
    owner_email: ownerEmail,
    widget_id: widgetId,
    subscription_status: 'active',
    site_status: siteStatus,
  })
  if (tenantError) throw tenantError

  let siteUrl: string | null = null
  let domainResult: ProvisionTenantResult['domain'] = null

  if (!isWidgetOnly) {
    const baseDomain = (process.env.TENANT_BASE_DOMAIN || 'localhost').replace(/^\.+|\.+$/g, '')
    const isLocalBase = baseDomain === 'localhost' || baseDomain.endsWith('.localhost')
    const platformHost = `${subdomain}.${baseDomain}`
    const customHost = normalizeDomain(setup.desiredDomain)
    // Slug used for all site-assets storage paths (hero, products, before).
    const assetSlug = (subdomain || tenantId)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || tenantId

    const { error: domainError } = await supabase.from('domains').insert({
      tenant_id: tenantId,
      hostname: platformHost,
      is_primary: !customHost,
      ssl_status: 'active',
    })
    if (domainError) throw domainError

    domainResult = { platformHost, customHost: null, vercel: null }

    if (customHost) {
      const { error: customDomainError } = await supabase.from('domains').insert({
        tenant_id: tenantId,
        hostname: customHost,
        is_primary: true,
        ssl_status: 'pending',
      })
      if (customDomainError) {
        console.error('Custom domain insert failed:', customDomainError)
        await supabase
          .from('domains')
          .update({ is_primary: true })
          .eq('tenant_id', tenantId)
          .eq('hostname', platformHost)
      } else {
        domainResult.customHost = customHost
        if (!isLocalBase) {
          domainResult.vercel = await attachVercelDomain(customHost)
        }
      }
    }

    const primaryHost = domainResult.customHost || domainResult.platformHost
    siteUrl = isLocalBase ? `http://${primaryHost}:3000` : `https://${primaryHost}`

    const serviceCatalog: Record<string, { image: string; description: string }> = {
      'Walk-In Closets': {
        image: 'https://images.unsplash.com/photo-1558211583-d26f610c1eb1',
        description: 'Luxurious walk-in spaces designed for your lifestyle.',
      },
      'Reach-In Closets': {
        image: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2',
        description: 'Maximize every inch with precision reach-in designs.',
      },
      Garages: {
        image: 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81',
        description: 'High-performance garage environments built to last.',
      },
      'Pantries & Wine': {
        image: 'https://images.unsplash.com/photo-1556910103-1c02745a872f',
        description: 'Elegant storage for culinary and wine collections.',
      },
      'Home Offices': {
        image: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36',
        description: 'Productive and beautifully organized workspaces.',
      },
      Mudrooms: {
        image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a',
        description: 'Seamless entryways that handle daily chaos.',
      },
      'Wall Beds': {
        image: 'https://images.unsplash.com/photo-1505693314120-0d443867891c',
        description: 'Transformative sleep solutions for multi-use rooms.',
      },
      'Entertainment Centers': {
        image: 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5',
        description: 'Sleek media walls for the ultimate viewing experience.',
      },
    }

    const GENERIC_HERO = 'https://images.unsplash.com/photo-1595428774223-ef52624120d2'
    const THEME_HERO_IMAGES: Record<string, string> = {
      'luxury-minimal': GENERIC_HERO,
      brutalist: 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81',
      'classic-warm': 'https://images.unsplash.com/photo-1556910103-1c02745a872f',
      'modern-office': 'https://images.unsplash.com/photo-1524758631624-e2822e304c36',
      'playful-kids': 'https://images.unsplash.com/photo-1505693314120-0d443867891c',
      'rustic-pantry': 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a',
      'sleek-entertainment': 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5',
      'elegant-dressing': 'https://images.unsplash.com/photo-1595428774223-ef52624120d2',
      'functional-utility': 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a',
      'creative-craft': 'https://images.unsplash.com/photo-1556910103-1c02745a872f',
      'sophisticated-wine': 'https://images.unsplash.com/photo-1556910103-1c02745a872f',
      'cozy-library': 'https://images.unsplash.com/photo-1524758631624-e2822e304c36',
      'minimalist-zen': GENERIC_HERO,
    }
    const PRODUCT_IMAGE_POOL = [
      'https://images.unsplash.com/photo-1595428774223-ef52624120d2',
      'https://images.unsplash.com/photo-1595428774223-ef52624120d2',
      'https://images.unsplash.com/photo-1605810230434-7631ac76ec81',
      'https://images.unsplash.com/photo-1556910103-1c02745a872f',
      'https://images.unsplash.com/photo-1524758631624-e2822e304c36',
      'https://images.unsplash.com/photo-1584622650111-993a426fbf0a',
      'https://images.unsplash.com/photo-1505693314120-0d443867891c',
      'https://images.unsplash.com/photo-1593640408182-31c70c8268f5',
    ]

    const industryDef = getIndustry(beforeAfterContext.industry)
    const fallbackServices = industryDef 
      ? industryDef.services.slice(0, 4).map(s => s.label) 
      : ['Walk-In Closets']

    const selectedServices =
      services && services.length > 0 ? services : fallbackServices

    // Authoritatively apply the prospect's generated + selected studio images.
    // Selections are keyed by service label and always win over catalog/AI
    // defaults, so an AI Premium build deploys exactly what the customer picked.
    let heroSelectedUrl: string | null = null
    const pickedImages: { name: string; url: string }[] = []
    // Prospect-selected pages become the authoritative sitemap — admins never
    // re-guess. Caps: AI Premium 10 total, Standard 5 total (Home included).
    let requestedPageSlugs: string[] = []
    let intakeTierForPages: 'standard' | 'ai_premium' = 'standard'
    let galleryUrls: string[] = []
    let pageContents: Record<string, string> = {}
    if (intakeId) {
      const { data: intakeForImages } = await supabase
        .from('prospect_intakes')
        .select(
          'token, services, other_services, image_selections, requested_pages, intake_tier, gallery_images, page_contents'
        )
        .eq('id', intakeId)
        .maybeSingle()
      if (intakeForImages) {
        const labels = provisionServiceLabels(intakeForImages)
        let sel = syncProductSlots(
          parseImageSelections(intakeForImages.image_selections),
          labels
        )
        // Legacy rows may still carry inline data: URLs — persist optimized copies
        // before we wire them into the live site config.
        if (intakeForImages.token) {
          sel = await persistImageSelections(intakeForImages.token, sel)
        }
        heroSelectedUrl = sel.hero.selectedUrl || null
        for (const p of sel.products) {
          if (p.selectedUrl) pickedImages.push({ name: p.serviceName, url: p.selectedUrl })
        }
        intakeTierForPages =
          intakeForImages.intake_tier === 'ai_premium' ? 'ai_premium' : 'standard'
        requestedPageSlugs = clampPagesForTier(
          intakeForImages.requested_pages,
          intakeTierForPages
        )
        galleryUrls = Array.isArray(intakeForImages.gallery_images)
          ? intakeForImages.gallery_images.filter(
              (u): u is string => typeof u === 'string' && u.trim().length > 0
            )
          : []
        pageContents = (intakeForImages.page_contents as Record<string, string>) || {}
      }
    }

    const normLabel = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\b(\w+?)s\b/g, '$1').trim()

    // Returns a stateful resolver: matches a product title to the best unused
    // selected image (exact label → word-overlap → positional), never reusing
    // a selection twice within one product list.
    const makeImageResolver = () => {
      const used = new Set<number>()
      return (title: string | undefined): string | null => {
        if (pickedImages.length === 0) return null
        const t = normLabel(title || '')
        let idx = pickedImages.findIndex(
          (p, i) =>
            !used.has(i) &&
            t.length > 0 &&
            (normLabel(p.name) === t ||
              normLabel(p.name).includes(t) ||
              t.includes(normLabel(p.name)))
        )
        if (idx < 0) {
          const tw = new Set(t.split(' ').filter((w) => w.length > 2))
          let best = 0
          pickedImages.forEach((p, i) => {
            if (used.has(i)) return
            let score = 0
            normLabel(p.name)
              .split(' ')
              .filter((w) => w.length > 2)
              .forEach((w) => {
                if (tw.has(w)) score++
              })
            if (score > best) {
              best = score
              idx = i
            }
          })
        }
        if (idx < 0) idx = pickedImages.findIndex((_, i) => !used.has(i))
        if (idx < 0) return null
        used.add(idx)
        return pickedImages[idx].url
      }
    }

    const defaultHeroBackground =
      heroSelectedUrl ||
      (heroImage && heroImage !== GENERIC_HERO
        ? heroImage
        : THEME_HERO_IMAGES[theme!] || GENERIC_HERO)
    const resolveDefaultProductImage = makeImageResolver()

    let siteConfigData: Record<string, unknown> = {
      tenant_id: tenantId,
      brand_name: businessName,
      theme: theme!,
      layout_style: layoutStyle || 'standard',
      theme_tokens: themeTokens || null,
      design_variant: designVariant || null,
      engagement_model: resolvedEngagementModel,
      default_room: 'Custom Space',
      logo_url: setup.logoUrl || null,
      pricing_notes: setup.pricingNotes || null,
      hero_config: {
        headline: heroHeadline || `Welcome to ${businessName}`,
        subheadline: (aiSiteConfig?.hero as { subheadline?: string })?.subheadline || null,
        backgroundImage: defaultHeroBackground,
      },
      about_config: {
        description:
          aboutDescription ||
          `${businessName} provides premium custom storage solutions tailored to your life.`,
      },
      process_config: {
        title: 'Our Process',
        subtitle: 'How we work',
        steps: [
          { number: '01', title: 'Consultation', description: 'We meet with you.' },
          { number: '02', title: 'Design', description: 'We design it.' },
          { number: '03', title: 'Install', description: 'We build it.' },
        ],
      },
      quiz_config: aiSiteConfig?.quiz || null,
      products_config: selectedServices.map((serviceName: string) => {
        const industryDef = getIndustry(beforeAfterContext.industry)
        const industryService = industryDef?.services.find((s) => s.label === serviceName)
        
        const catalogItem = serviceCatalog[serviceName] || industryService?.catalog || {
          image: GENERIC_HERO,
          description: isOrderBusiness ? 'Premium menu item.' : 'Premium service offering.',
        }
        
        const subtitle = isOrderBusiness ? 'Freshly Prepared' : 'Expert Service'
        const longDesc = isOrderBusiness 
          ? `Enjoy our freshly prepared ${serviceName}, crafted to order.`
          : `Professional, high-quality execution for your ${serviceName}.`
        const specs = isOrderBusiness
          ? ['Premium Quality', 'Made to Order', 'Satisfaction Guaranteed']
          : ['Premium Materials', 'Professional Execution', 'Quality Guaranteed']

        return {
          title: serviceName,
          image: resolveDefaultProductImage(serviceName) || catalogItem.image,
          description: catalogItem.description,
          details: {
            subtitle,
            longDescription: longDesc,
            specifications: specs,
          },
        }
      }),
      seo_config: {
        legalName: businessName,
        email: setup.contactEmail || ownerEmail || '',
        phone: setup.contactPhone || '555-0199',
        streetAddress: setup.streetAddress || '123 Main St',
        addressLocality: setup.addressLocality || setup.serviceArea || 'Anytown',
        addressRegion: setup.addressRegion || 'NY',
        postalCode: setup.postalCode || '10001',
        geo: { latitude: '40.7128', longitude: '-74.0060' },
      },
      before_after_config: beforeAfterApplicable
        ? {
            // beforeImage resolved below after async generation
            beforeImage: beforeImage || '/brands/lumina/before.png',
            afterImage: defaultHeroBackground || '/brands/lumina/hero.png',
            title: `The ${businessName} Transformation`,
            subtitle: 'Drag to see',
          }
        : null,
    }

    // Generate a unique messy "before" image anchored to this site's after
    // image / space type. Runs for all tiers. Gracefully falls back to the
    // static placeholder so provisioning never hard-fails. Skipped entirely
    // when there's no physical "before" state for this business (see
    // beforeAfterApplicable above) — saves a real AI image-generation call
    // and avoids rendering a nonsensical before/after slider.
    if (beforeAfterApplicable && process.env.OPENAI_API_KEY) {
      const afterUrl = defaultHeroBackground || '/brands/lumina/hero.png'
      const generatedBeforeUrl = await generateBeforeImage(afterUrl, assetSlug, beforeAfterContext).catch((err) => {
        console.warn('[provisionTenant] Before image generation failed, using fallback:', err)
        return null
      })
      if (generatedBeforeUrl) {
        ;(siteConfigData.before_after_config as Record<string, unknown>).beforeImage =
          generatedBeforeUrl
      }
    }

    if (aiSiteConfig) {
      const finalTheme = theme || (aiSiteConfig.theme as string)
      const operatorHero =
        heroImage && heroImage !== GENERIC_HERO ? heroImage : null
      const backgroundImage =
        heroSelectedUrl || operatorHero || THEME_HERO_IMAGES[finalTheme] || GENERIC_HERO
      const aiProducts = Array.isArray(aiSiteConfig.products)
        ? aiSiteConfig.products
        : null
      const resolveAiProductImage = makeImageResolver()
      const productsWithImages = (
        aiProducts ?? (siteConfigData.products_config as unknown[])
      ).map(
        (
          p: {
            title?: string
            image?: string
            imagePrompt?: string
            description?: string
            details?: {
              subtitle?: string
              longDescription?: string
              specifications?: string[]
            }
            [k: string]: unknown
          },
          i: number
        ) => {
          const { imagePrompt: _imagePrompt, ...rest } = p
          void _imagePrompt
          const title = p.title || `Custom Build ${i + 1}`
          return {
            ...rest,
            title,
            // Guarantee premium copy is always present so the rendered product
            // modal never shows empty fields, even if the AI omitted one.
            description:
              p.description ||
              serviceCatalog[title]?.description ||
              `Bespoke ${title.toLowerCase()} crafted with premium materials and precision joinery.`,
            details: {
              subtitle: p.details?.subtitle || 'Signature Collection',
              longDescription:
                p.details?.longDescription ||
                `Full architectural build-out for your ${title.toLowerCase()}, engineered for flawless daily function and lasting craftsmanship.`,
              specifications:
                p.details?.specifications && p.details.specifications.length > 0
                  ? p.details.specifications
                  : ['Premium Materials', 'Precision Fit', 'Lifetime Warranty'],
            },
            image:
              resolveAiProductImage(p.title) ||
              p.image ||
              (p.title && serviceCatalog[p.title]?.image) ||
              PRODUCT_IMAGE_POOL[i % PRODUCT_IMAGE_POOL.length],
          }
        }
      )

      siteConfigData = {
        ...siteConfigData,
        theme: finalTheme,
        default_room: (aiSiteConfig.defaultRoom as string) || siteConfigData.default_room,
        hero_config: {
          headline:
            (aiSiteConfig.hero as { headline?: string })?.headline ||
            (siteConfigData.hero_config as { headline: string }).headline,
          subheadline:
            (aiSiteConfig.hero as { subheadline?: string })?.subheadline ||
            (siteConfigData.hero_config as { subheadline?: string | null }).subheadline ||
            null,
          backgroundImage,
        },
        about_config: aiSiteConfig.about || siteConfigData.about_config,
        process_config: aiSiteConfig.process || siteConfigData.process_config,
        quiz_config: aiSiteConfig.quiz || siteConfigData.quiz_config,
        engagement_model: (aiSiteConfig.engagementModel as string) || siteConfigData.engagement_model,
        products_config: productsWithImages,
      }

      // Update afterImage to the AI-resolved background.
      // Re-generate the before image against the final after URL so the slider
      // pair always references the same space type. Skipped entirely when
      // this business has no physical "before" state (beforeAfterApplicable).
      if (beforeAfterApplicable) {
        const aiAfterUrl = backgroundImage
        siteConfigData.before_after_config = {
          ...(siteConfigData.before_after_config as object),
          afterImage: aiAfterUrl,
        }
        if (process.env.OPENAI_API_KEY) {
          const regeneratedBeforeUrl = await generateBeforeImage(aiAfterUrl, assetSlug, beforeAfterContext).catch(
            (err) => {
              console.warn('[provisionTenant] AI before image generation failed, using fallback:', err)
              return null
            }
          )
          if (regeneratedBeforeUrl) {
            ;(siteConfigData.before_after_config as Record<string, unknown>).beforeImage =
              regeneratedBeforeUrl
          }
        }
      }

      if (aiSiteConfig.pagesConfig && Array.isArray(aiSiteConfig.pagesConfig)) {
        const pageImagePool = productsWithImages
          .map((p: { image?: string }) => p.image)
          .filter(Boolean) as string[]
        const pool = pageImagePool.length > 0 ? pageImagePool : PRODUCT_IMAGE_POOL
        type PageConfig = {
          slug: string
          title: string
          is_active?: boolean
          hero?: Record<string, unknown>
          content_blocks?: Array<{ type?: string; image?: string }>
        }
        const sanitizedPages = (aiSiteConfig.pagesConfig as PageConfig[])
          .slice(0, maxAdditionalPagesForTier(intakeTierForPages))
          .map(
          (page, pIdx) => ({
            ...page,
            hero: { ...(page.hero || {}), backgroundImage },
            content_blocks: Array.isArray(page.content_blocks)
              ? page.content_blocks.map((block, bIdx) =>
                  block.type === 'image_left' || block.type === 'image_right'
                    ? {
                        ...block,
                        image: pool[(pIdx + bIdx) % pool.length],
                      }
                    : block
                )
              : page.content_blocks,
          })
        )
        siteConfigData.pages_config = sanitizedPages
        const navLinks = [{ label: 'Home', slug: '/' }]
        sanitizedPages.forEach((page) => {
          if (page.is_active !== false) {
            navLinks.push({ label: page.title, slug: page.slug })
          }
        })
        siteConfigData.nav_links = navLinks
      }
    }

    // Standard (non-AI) builds: ship exactly the pages the prospect chose on
    // the intake form so the admin never guesses the sitemap. AI Premium
    // builds already set pages_config above from the art-directed pagesConfig.
    if (!siteConfigData.pages_config && requestedPageSlugs.length > 0) {
      const stdImagePool = ((siteConfigData.products_config as Array<{ image?: string }>) || [])
        .map((p) => p?.image)
        .filter((u): u is string => typeof u === 'string' && u.length > 0)
      const basicPages = buildBasicPagesConfig(
        clampPagesForTier(requestedPageSlugs, intakeTierForPages),
        pageContents,
        stdImagePool.length > 0 ? stdImagePool : PRODUCT_IMAGE_POOL
      )
      if (basicPages.length > 0) {
        siteConfigData.pages_config = basicPages
        const navLinks = [{ label: 'Home', slug: '/' }]
        basicPages.forEach((page) => {
          navLinks.push({ label: page.title, slug: page.slug })
        })
        siteConfigData.nav_links = navLinks
      }
    }

    // Single-page sites (no additional pages requested/generated above) used
    // to end up with `nav_links: []` — which makes the renderer skip the
    // themed <Navbar> entirely (6 structural compositions, per-theme accent
    // colors, real fonts) and fall back to a bare logo-only header, the SAME
    // one for every theme. Give them an in-page anchor nav instead so they
    // still get real Navbar variety. Skipped for the two layouts that
    // deliberately strip everything down to hero+quote (no About/Portfolio
    // sections exist on those pages, so anchor links would be dead links).
    if (
      (!siteConfigData.nav_links || (siteConfigData.nav_links as unknown[]).length === 0) &&
      !(MINIMAL_LAYOUTS_WITHOUT_ANCHOR_SECTIONS as Set<string>).has(String(siteConfigData.layout_style))
    ) {
      const navCtaLabel = resolvedEngagementModel === 'order' ? 'Order'
        : resolvedEngagementModel === 'booking' ? 'Book Now'
        : resolvedEngagementModel === 'ticket' ? 'Get Tickets'
        : 'Get Quote'
      siteConfigData.nav_links = [
        { label: 'Home', slug: '/' },
        { label: 'About', slug: '/#about' },
        { label: 'Our Work', slug: '/#portfolio' },
        { label: navCtaLabel, slug: '/#quote' },
      ]
    }

    // Populate the Portfolio/Gallery page. Prefer the prospect's uploaded
    // project photos; when none were uploaded, fall back to the product/service
    // images so the gallery is never empty.
    if (
      Array.isArray(siteConfigData.pages_config) &&
      (siteConfigData.pages_config as BasicPageConfig[]).length > 0
    ) {
      const productImagePool = ((siteConfigData.products_config as Array<{ image?: string }>) || [])
        .map((p) => p?.image)
        .filter((u): u is string => typeof u === 'string' && u.length > 0)
      const galleryImages = galleryUrls.length > 0 ? galleryUrls : productImagePool
      if (galleryImages.length > 0) {
        siteConfigData.pages_config = injectGalleryImagesIntoPages(
          siteConfigData.pages_config as BasicPageConfig[],
          galleryImages
        )
      }
    }

    // Deterministically pick this site's design. Unless the admin forced a
    // named preset, derive a seed from the contractor's answers and probe it
    // against every existing site in the same theme so the resulting design is
    // never an exact duplicate. The stored seed drives the renderer's entire
    // visual voice (structure + typography + accent color).
    try {
      if (isForcedPreset(designVariant)) {
        siteConfigData.design_variant = designVariant
      } else {
        const resolvedTheme = String(siteConfigData.theme || theme || '')
        if (resolvedTheme) {
          siteConfigData.design_variant = await resolveDesignSeed({
            supabase,
            theme: resolvedTheme,
            answers: [
              businessName,
              subdomain,
              (selectedServices || []).join(','),
              setup.serviceArea,
              setup.addressLocality,
              layoutStyle,
            ],
            fallbackId: tenantId,
            excludeTenantId: tenantId,
          })
        }
      }
    } catch (seedError) {
      if (isMissingDesignVariantColumn(seedError)) {
        // Environment is missing the new design_variant column. Continue with
        // legacy behavior so provisioning still succeeds.
        delete siteConfigData.design_variant
      } else {
        throw seedError
      }
    }

    const { error: configError } = await supabase.from('site_configs').insert(siteConfigData)
    if (configError && isMissingDesignVariantColumn(configError)) {
      // Retry once without the new field for DBs that haven't applied the
      // migration yet or have stale PostgREST schema cache.
      delete siteConfigData.design_variant
      const { error: legacyInsertError } = await supabase.from('site_configs').insert(siteConfigData)
      if (legacyInsertError) throw legacyInsertError
    } else if (configError) {
      throw configError
    }
  }

  const aiCustomRooms =
    (aiWidgetConfig as { customRooms?: CustomRoomInput[] } | null)?.customRooms ?? []
  const engineTierDefaults = getEngineTierDefaults(beforeAfterContext.industry)
  const mergedCustomRooms = mergeCustomRoomsWithServices(
    aiCustomRooms,
    services,
    engineTierDefaults
  )
  if (isOrderBusiness) {
    // Order-industry businesses (see EngagementModel) — seed the menu/catalog
    // items into the menu_items table. If the AI sandbox generated customRooms,
    // adapt those into menu items.
    let finalMenuItems = menuItems || []
    if (finalMenuItems.length === 0 && mergedCustomRooms.length > 0) {
      finalMenuItems = mergedCustomRooms.map(r => ({
        name: r.name,
        price: r.standard || r.basic || engineTierDefaults.standard,
        category: 'Menu'
      }))
    }
    
    if (finalMenuItems.length > 0) {
      await supabase.from('menu_items').insert(
        finalMenuItems.map((item, i) => ({
          contractor_id: tenantId,
          name: item.name,
          price: item.price,
          category: item.category || 'Menu',
          sort_order: i,
        }))
      )
    }
  } else if (isBookingBusiness) {
    // Seed booking services from AI customRooms
    if (mergedCustomRooms.length) {
      await supabase.from('service_catalog').insert(
        mergedCustomRooms.map((r, i) => ({
          contractor_id: tenantId,
          name: r.name,
          duration_minutes: 60,
          price_cents: (r.standard || r.basic || engineTierDefaults.standard) * 100, // custom rooms are in dollars
          sort_order: i,
        }))
      )
    }
    // Seed default availability (Mon-Fri 9-5)
    await supabase.from('booking_availability').insert(
      [1, 2, 3, 4, 5].map(day => ({
        contractor_id: tenantId,
        day_of_week: day,
        start_time: '09:00',
        end_time: '17:00',
        slot_duration_minutes: 60
      }))
    )
  } else if (isTicketBusiness) {
    // Seed a default event
    if (mergedCustomRooms.length) {
      const mainService = mergedCustomRooms[0];
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      
      await supabase.from('ticket_events').insert({
        contractor_id: tenantId,
        name: mainService.name,
        description: 'Join us for this exciting event.',
        event_date: nextMonth.toISOString().split('T')[0],
        event_time: '19:00',
        venue: 'Main Venue',
        capacity: 100,
        price_cents: (mainService.standard || mainService.basic || engineTierDefaults.standard) * 100,
        is_active: true
      })
    }
  } else {
    // Quote-industry businesses — seed into contractor_rooms
    if (mergedCustomRooms.length) {
      await supabase.from('contractor_rooms').insert(
        mergedCustomRooms.map((r) => ({
          contractor_id: tenantId,
          name: r.name,
          price_basic: r.basic || 0,
          price_standard: r.standard || 0,
          price_premium: r.premium || 0,
        }))
      )
    }
  }

  if (aiWidgetConfig) {
    const { customAddOns, customFinishes } = aiWidgetConfig as {
      customAddOns?: Array<{ name: string; roomType?: string; price?: number }>
      customFinishes?: Array<{
        label: string
        description?: string
        swatchHex?: string
        tier?: string
      }>
    }

    if (customAddOns?.length) {
      await supabase.from('contractor_addons').insert(
        customAddOns.map((a) => ({
          contractor_id: tenantId,
          name: a.name,
          room_type: a.roomType,
          price: a.price || 0,
        }))
      )
    }
    if (customFinishes?.length) {
      await supabase.from('contractor_finishes').insert(
        customFinishes.map((f, i) => ({
          contractor_id: tenantId,
          label: f.label,
          description: f.description,
          swatch_hex: f.swatchHex || '#cccccc',
          tier: f.tier || 'basic',
          sort_order: i,
        }))
      )
    }
  }

  // Reconcile disabled-default-rooms + the human industry label + domain
  // config against the FINAL services/rooms list. This runs UNCONDITIONALLY
  // (not gated on aiWidgetConfig being present) — a business provisioned
  // without ever clicking the optional "Generate AI Widget" button (e.g. the
  // admin sandbox tool, or any flow that just uses the services checkboxes)
  // used to keep every closet default room (Walk-In Closet, Garage, Pantry &
  // Wine, ...) enabled alongside its real custom rooms, since this whole
  // reconciliation previously lived inside `if (aiWidgetConfig)`. Similarly,
  // contractor_settings.industry was left at the raw DB default
  // ('Custom Closets') for completely unrelated trades.
  const widgetCfg = (aiWidgetConfig ?? {}) as Record<string, unknown>
  const aiDisabledRooms = widgetCfg._disabledDefaultRooms as string[] | undefined
  const aiDisableFinishes = widgetCfg._disableDefaultFinishes as boolean | undefined
  const aiTierNames = widgetCfg.tierNames as
    | { basic?: string; standard?: string; premium?: string }
    | undefined
  const aiIndustry =
    typeof widgetCfg.industry === 'string' && widgetCfg.industry.trim().length > 0
      ? widgetCfg.industry.trim()
      : undefined
  const aiDomainConfig = widgetCfg.domainConfig as Record<string, unknown> | undefined

  const disabledRooms = aiDisabledRooms ?? inferDisabledDefaultRooms(services)
  const disabledFinishes = aiDisableFinishes ? ['basic', 'standard', 'premium'] : []
  const resolvedIndustryLabel = aiIndustry ?? getIndustry(beforeAfterContext.industry).label

  await supabase
    .from('contractor_settings')
    .update({
      disabled_default_rooms: disabledRooms,
      ...(disabledFinishes.length > 0 ? { disabled_default_finishes: disabledFinishes } : {}),
      ...(aiTierNames ? { tier_names: aiTierNames } : {}),
      industry: resolvedIndustryLabel,
      ...(aiDomainConfig ? { domain_config: aiDomainConfig } : {}),
    })
    .eq('id', tenantId)



  const tempPassword = generateTempPassword()
  let authUserId: string | null = null

  const { data: existingUsers } = await supabase.auth.admin.listUsers()
  const existingUser = existingUsers.users.find((u) => u.email === ownerEmail)

  if (!existingUser) {
    const { data: created, error: authError } = await supabase.auth.admin.createUser({
      email: ownerEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        force_password_reset: true,
        tenant_id: tenantId,
        widget_id: widgetId,
      },
    })
    if (authError) console.error('Failed to create auth user:', authError)
    else authUserId = created.user?.id ?? null
  } else {
    authUserId = existingUser.id
    await supabase.auth.admin.updateUserById(existingUser.id, {
      password: tempPassword,
      user_metadata: {
        force_password_reset: true,
        tenant_id: tenantId,
        widget_id: widgetId,
      },
    })
  }

  if (authUserId) {
    await supabase
      .from('contractor_settings')
      .update({ user_id: authUserId, contact_email: ownerEmail })
      .eq('id', tenantId)
  }

  const loginUrl = `${loginOrigin.replace(/\/$/, '')}/login`
  const embedSnippet = widgetEmbedSnippet(widgetId, engagementModel)

  if (sendWelcomeEmail && process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const pendingSite = !isWidgetOnly && siteStatus === 'pending_approval'
    const productLine = isWidgetOnly
      ? `<p>Your Quote Calculator widget is ready to embed on your existing website. Paste this snippet where you want the calculator to appear:</p>
         <pre style="background:#f4f4f4;padding:12px;border-radius:6px;white-space:pre-wrap;word-break:break-all;">${embedSnippet.replace(/</g, '&lt;')}</pre>`
      : pendingSite
        ? `<p>Your custom site has been provisioned and is pending admin approval. We will notify you when it is live.</p>`
        : `<p>Your custom site is live.</p>`

    await resend.emails.send({
      from: process.env.INTAKE_FROM_EMAIL || 'DitchTheForm <admin@closetquotes.com>',
      to: [ownerEmail],
      subject: isWidgetOnly
        ? 'Your DitchTheForm Calculator is ready to embed'
        : pendingSite
          ? 'Welcome to DitchTheForm! Your site is pending approval.'
          : 'Welcome to DitchTheForm!',
      html: `
        <h1>Welcome, ${businessName}!</h1>
        ${productLine}
        <p>You can log in to your dashboard to manage your widget and settings.</p>
        <p><strong>Login URL:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
        <p><strong>Email:</strong> ${ownerEmail}</p>
        <p><strong>Temporary Password:</strong> ${tempPassword}</p>
        <p><em>Note: You will be required to change this password upon your first login.</em></p>
      `,
    })
  }

  if (intakeId) {
    try {
      await supabase
        .from('prospect_intakes')
        .update({
          status: 'built',
          provisioned_contractor_id: tenantId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', intakeId)

      if (!isWidgetOnly) {
        await syncTenantLaunchAccess({ tenantId, intakeId })
      }
    } catch (err) {
      console.error('Failed to mark intake built:', err)
    }
  }

  if (!isWidgetOnly && siteUrl) {
    // Best-effort on-demand cache invalidation so the tenant site reflects
    // this provisioning immediately instead of waiting out its 60s cache
    // window (see custom-closets-websites getConfig.ts / api/revalidate).
    // Never let a failure here fail provisioning — the site self-heals
    // within 60s regardless.
    const secret = process.env.ADMIN_BYPASS_SECRET?.trim()
    if (secret) {
      try {
        await fetch(`${siteUrl.replace(/\/$/, '')}/api/revalidate`, {
          method: 'POST',
          headers: { 'x-revalidate-secret': secret },
          signal: AbortSignal.timeout(5000),
        })
      } catch (err) {
        console.error('Failed to revalidate tenant site cache:', err)
      }
    }
  }

  // Agentic site-validation gate: before a freshly built full site is offered
  // to the admin for preview/approval, run the automated QA battery (theme/
  // layout consistency, nav presence, broken links/images, duplicate/
  // non-bespoke design). Tracked on `tenants.validation_status` — completely
  // independent of `site_status` (the payment/launch state machine set just
  // above via syncTenantLaunchAccess) so the two concerns never conflict.
  // Best-effort: never let a validator failure fail provisioning itself —
  // worst case the tenant is left with validation_status='pending' for the
  // admin to re-run manually from /admin/sites/[id].
  if (!isWidgetOnly) {
    try {
      const report = await validateTenantSite(tenantId)
      await saveValidationReport(tenantId, report)
    } catch (err) {
      console.error('Site validation failed to run:', err)
      try {
        await supabase.from('tenants').update({ validation_status: 'pending' }).eq('id', tenantId)
      } catch {
        // best-effort only
      }
    }
  }

  return {
    success: true,
    mode,
    tenantId,
    widgetId,
    url: isWidgetOnly ? null : siteUrl,
    domain: domainResult,
    embedSnippet,
    ownerEmail,
    loginUrl,
    tempPassword,
    authUserId,
  }
}
