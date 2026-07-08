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
import { mergeProspectImageSelections } from '@/lib/intake/mergeProspectImages'
import { extractProspectSiteConfig } from '@/lib/intake/mergeProspectImages'
import { depositSatisfied, effectiveIntakeTier } from '@/lib/intake/intakeTierGates'
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

export function hasProspectPageCopy(row: ProspectIntakeRow): boolean {
  const pc = row.page_contents
  if (!pc || typeof pc !== 'object') return false
  return Object.values(pc).some((v) => typeof v === 'string' && v.trim().length > 80)
}

export function validateAiPremiumReady(row: ProspectIntakeRow): string | null {
  if (effectiveIntakeTier(row) !== 'ai_premium') return null
  if (!depositSatisfied(row)) {
    return 'Deposit not paid'
  }
  const hasBrief = extractProspectSiteConfig(row.ai_site_config) !== null
  if (!hasBrief && !hasProspectPageCopy(row)) {
    return 'AI site config missing — run Generate brief or fill in page content first'
  }
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
  const rawConfig = row.ai_site_config as Record<string, unknown> | null
  const pageContents =
    row.page_contents && typeof row.page_contents === 'object'
      ? (row.page_contents as Record<string, string>)
      : {}
  const businessName = row.business_name?.trim() || 'Your Business'
  const prospectSite = extractProspectSiteConfig(rawConfig) ?? {}
  const bundle = parseAiSiteBundle(row.ai_site_config)
  const site = {
    ...prospectSite,
    hero: {
      ...prospectSite.hero,
      headline:
        prospectSite.hero?.headline ||
        (bundle?.siteConfig?.hero as { headline?: string } | undefined)?.headline ||
        `Welcome to ${businessName}`,
    },
    about: {
      description:
        prospectSite.about?.description ||
        pageContents.about?.trim() ||
        '',
    },
    products: prospectSite.products ?? bundle?.siteConfig?.products,
  }
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

  const { config: mergedSite } = mergeProspectImageSelections(site, selections)

  const aiSiteConfig = {
    ...mergedSite,
    theme,
    layoutStyle,
    designVariant: resolved.designVariantOverride || (site as { designVariant?: string }).designVariant,
    // The model returns pagesConfig at the TOP level of ai_site_config (sibling
    // of siteConfig), so it must be lifted in here — otherwise provisioning
    // never sees it and falls back to empty placeholder pages. Reconcile slugs
    // against the prospect's chosen pages so routing + nav stay correct.
    pagesConfig: normalizeAiPagesConfig(
      rawConfig?.pagesConfig,
      row.requested_pages ?? [],
      effectiveIntakeTier(row),
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
    // The theme is a deliberate choice only when the AI actually produced one;
    // otherwise it came from rules resolution and provisioning may rebalance it
    // across the industry pool so same-trade prospects don't collide.
    themeAutoResolved: !site.theme,
    engagementModel,
    menuItems: Array.isArray(row.menu_items) ? row.menu_items : [],
    subdomain,
    ownerEmail: (row.contact_email || row.notification_email || '').trim(),
    heroHeadline: site.hero?.headline,
    aboutDescription: site.about?.description || undefined,
    heroImage: selections.hero.selectedUrl,
    services,
    aiSiteConfig: aiSiteConfig as Record<string, unknown>,
    aiWidgetConfig: bundle?.widgetConfig ?? null,
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
