import {
  presentationFromIntakeRow,
  resolveSitePresentation,
} from '@/lib/ai/resolveSitePresentation'
import {
  coerceLayoutSlug,
  coerceThemeSlug,
} from '@/lib/catalog/sitePresentationCatalog'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'
import {
  imageSelectionsComplete,
  parseImageSelections,
  syncProductSlots,
} from '@/lib/intake/imageSelections'
import { provisionServiceLabels } from '@/lib/intake/provisionServiceLabels'
import { normalizeAiPagesConfig } from '@/lib/catalog/sitePages'
import type { ProvisionTenantInput } from '@/lib/provision/types'

type AiSiteBundle = {
  siteConfig?: {
    theme?: string
    defaultRoom?: string
    hero?: { headline?: string; imagePrompt?: string }
    about?: { description?: string }
    process?: unknown
    products?: Array<{
      title?: string
      description?: string
      image?: string
      imagePrompt?: string
      details?: unknown
    }>
  }
  widgetConfig?: Record<string, unknown>
}

export function parseAiSiteBundle(raw: unknown): AiSiteBundle | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.siteConfig && typeof o.siteConfig === 'object') {
    return {
      siteConfig: o.siteConfig as AiSiteBundle['siteConfig'],
      widgetConfig:
        o.widgetConfig && typeof o.widgetConfig === 'object'
          ? (o.widgetConfig as Record<string, unknown>)
          : undefined,
    }
  }
  return { siteConfig: o as AiSiteBundle['siteConfig'] }
}

export function validateAiPremiumReady(row: ProspectIntakeRow): string | null {
  if (row.intake_tier !== 'ai_premium') return null
  if (row.deposit_required_cents > 0 && row.deposit_status !== 'paid') {
    return 'Deposit not paid'
  }
  const bundle = parseAiSiteBundle(row.ai_site_config)
  if (!bundle?.siteConfig) return 'AI site config missing — run Generate brief first'
  const services = provisionServiceLabels(row)
  const selections = syncProductSlots(parseImageSelections(row.image_selections), services)
  if (!imageSelectionsComplete(selections, services)) {
    return 'Select hero and product images before submitting'
  }
  return null
}

export async function buildAiProvisionPayload(
  row: ProspectIntakeRow,
  loginOrigin: string,
  subdomain: string
): Promise<ProvisionTenantInput> {
  const bundle = parseAiSiteBundle(row.ai_site_config)!
  const site = bundle.siteConfig!
  const rawConfig = row.ai_site_config as Record<string, unknown> | null
  const storedPres = rawConfig?.presentation as
    | { theme?: string; layoutStyle?: string; resolvedAt?: string }
    | undefined

  let theme = coerceThemeSlug(site.theme || storedPres?.theme)
  let layoutStyle = coerceLayoutSlug(
    (site as { layoutStyle?: string }).layoutStyle || storedPres?.layoutStyle
  )

  // Deterministic quote-vs-order detection (see EngagementModel in
  // catalog/types.ts) — always resolved (useGemini:false keeps this cheap, no
  // network call), independent of whether theme/layoutStyle were already
  // stored from a prior review-step resolution.
  const resolved = await resolveSitePresentation(presentationFromIntakeRow(row), {
    useGemini: false,
  })
  if (!site.theme) theme = resolved.theme
  if (!(site as { layoutStyle?: string }).layoutStyle) layoutStyle = resolved.layoutStyle
  const engagementModel = resolved.engagementModel

  const services = provisionServiceLabels(row)
  const selections = syncProductSlots(parseImageSelections(row.image_selections), services)

  const products = (site.products ?? []).map((p, i) => {
    const sel = selections.products.find(
      (s) => s.productIndex === i || s.serviceName === p.title
    )
    return {
      ...p,
      image: sel?.selectedUrl || p.image,
    }
  })

  const aiSiteConfig = {
    ...site,
    theme,
    layoutStyle,
    designVariant: resolved.designVariantOverride || (site as { designVariant?: string }).designVariant,
    products,
    // The model returns pagesConfig at the TOP level of ai_site_config (sibling
    // of siteConfig), so it must be lifted in here — otherwise provisioning
    // never sees it and falls back to empty placeholder pages. Reconcile slugs
    // against the prospect's chosen pages so routing + nav stay correct.
    pagesConfig: normalizeAiPagesConfig(
      rawConfig?.pagesConfig,
      row.requested_pages ?? [],
      row.intake_tier === 'ai_premium' ? 'ai_premium' : 'standard',
      row.page_contents
    ),
    presentation: storedPres ?? {
      theme,
      layoutStyle,
      resolvedAt: new Date().toISOString(),
    },
  }

  return {
    businessName: row.business_name?.trim() || 'Your Business',
    theme,
    layoutStyle,
    engagementModel,
    menuItems: Array.isArray(row.menu_items) ? row.menu_items : [],
    subdomain,
    ownerEmail: (row.notification_email || row.contact_email || '').trim(),
    heroHeadline: site.hero?.headline,
    aboutDescription: site.about?.description,
    heroImage: selections.hero.selectedUrl,
    services,
    aiSiteConfig: aiSiteConfig as Record<string, unknown>,
    aiWidgetConfig: bundle.widgetConfig ?? null,
    intakeSetup: {
      contactEmail: row.contact_email || undefined,
      contactPhone: row.contact_phone || undefined,
      notificationEmail: row.notification_email || undefined,
      notificationPhone: row.notification_phone || undefined,
      streetAddress: row.street_address || undefined,
      addressLocality: row.address_locality || undefined,
      addressRegion: row.address_region || undefined,
      postalCode: row.postal_code || undefined,
      serviceArea: row.service_area || undefined,
      primaryColorHex: row.primary_color_hex || undefined,
      logoUrl: row.logo_url || undefined,
      desiredDomain: row.desired_domain || undefined,
      pricingNotes: row.pricing_notes || undefined,
    },
    intakeId: row.id,
    mode: 'full',
    siteStatus: 'pending_approval',
    loginOrigin,
    sendWelcomeEmail: true,
  }
}
