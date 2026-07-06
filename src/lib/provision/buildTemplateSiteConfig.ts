import type { IntakeRowForProvision } from '@/lib/provision/types'
import {
  presentationFromIntakeRow,
  resolveSitePresentation,
} from '@/lib/ai/resolveSitePresentation'
import type { ThemeTokenSelection } from '@/lib/ai/synthesizeThemeTokens'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'
import { generateQuizConfig } from '@/lib/ai/generateQuizConfig'
import {
  getServiceCatalogEntry,
  SERVICE_LABELS,
} from '@/lib/catalog/contractorServices'
import { coerceLayoutSlug, coerceThemeSlug, THEME_SLUGS } from '@/lib/catalog/sitePresentationCatalog'

export { VIBE_TO_THEME } from '@/lib/catalog/sitePresentationCatalog'

const THEME_HERO: Record<string, string> = {
  'luxury-minimal': 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c',
  brutalist: 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81',
  'classic-warm': 'https://images.unsplash.com/photo-1556910103-1c02745a872f',
  'modern-office': 'https://images.unsplash.com/photo-1524758631624-e2822e304c36',
  'playful-kids': 'https://images.unsplash.com/photo-1505693314120-0d443867891c',
  'rustic-pantry': 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a',
  'sleek-entertainment': 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5',
  'elegant-dressing': 'https://images.unsplash.com/photo-1595428774223-ef52624120d2',
  'functional-utility': 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e',
  'creative-craft': 'https://images.unsplash.com/photo-1452860607046-6d350d744276',
  'sophisticated-wine': 'https://images.unsplash.com/photo-1556910103-1c02745a872f',
  'cozy-library': 'https://images.unsplash.com/photo-1507842217343-583bb7270b66',
  'minimalist-zen': 'https://images.unsplash.com/photo-1545389336-cf090694435e',
  'garage-industrial': 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81',
  'pantry-fresh': 'https://images.unsplash.com/photo-1556910103-1c02745a872f',
  'laundry-clean': 'https://images.unsplash.com/photo-1585429371326-7f264a7de3d0',
  'mudroom-family': 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a',
  'commercial-pro': 'https://images.unsplash.com/photo-1497366216548-37526070297c',
  'coastal-climate': 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81',
  'historic-classic': 'https://images.unsplash.com/photo-1556910103-1c02745a872f',
  'luxury-gallery': 'https://images.unsplash.com/photo-1577083552431-6e5fd01988ec',
  'kids-playful': 'https://images.unsplash.com/photo-1505693314120-0d443867891c',
  'media-theater': 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5',
  'office-executive': 'https://images.unsplash.com/photo-1524758631624-e2822e304c36',
  'wine-cellar': 'https://images.unsplash.com/photo-1556910103-1c02745a872f',
  // New trade-vertical themes (wave 1) — previously MISSING from this map
  // entirely, so every one of these silently fell through to GENERIC_HERO
  // (the same single closet stock photo) regardless of the assigned theme.
  'fresh-clean': 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac',
  'warm-handyman': 'https://images.unsplash.com/photo-1504307651254-35680f356dfd',
  'rich-flooring': 'https://images.unsplash.com/photo-1578662996442-48f60103fc96',
  'artisan-wood': 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261',
  'swift-mobile': 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f',
  'clean-move': 'https://images.unsplash.com/photo-1600518464441-9154a4dea21b',
  'urban-reclaim': 'https://images.unsplash.com/photo-1558618047-f4cf4f1d82af',
  'stone-masonry': 'https://images.unsplash.com/photo-1558981852-426c349dafd0',
  'appliance-pro': 'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1',
  'care-comfort': 'https://images.unsplash.com/photo-1507842217343-583bb7270b66',
  // Second wave
  'pool-resort': 'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7',
  'home-guardian': 'https://images.unsplash.com/photo-1560518883-ce09059eeffa',
  'eco-solar': 'https://images.unsplash.com/photo-1509391366360-2e959784a276',
  'pastoral-pet': 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7',
  'hearth-warm': 'https://images.unsplash.com/photo-1513694203232-719a280e022f',
  'seasonal-outdoor': 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b',
  'garage-smart': 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81',
  'window-light': 'https://images.unsplash.com/photo-1581578731548-c64695cc6952',
  // Third wave
  'bold-remodel': 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136',
  'winter-ready': 'https://images.unsplash.com/photo-1551529834-525807d6b4f3',
  'event-festive': 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30',
  'wellness-calm': 'https://images.unsplash.com/photo-1595428774223-ef52624120d2',
  'fleet-logistics': 'https://images.unsplash.com/photo-1545558014-8692077e9b5c',
  'media-creative': 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32',
  'gourmet-warm': 'https://images.unsplash.com/photo-1555507036-ab1f4038808a',
}

export const GENERIC_HERO = 'https://images.unsplash.com/photo-1558211583-d26f610c1eb1'

export type TemplateSiteParams = {
  businessName: string
  theme: string
  layoutStyle?: string
  services: string[]
  intake: IntakeRowForProvision
}

function rowAsProspect(row: IntakeRowForProvision): ProspectIntakeRow {
  return row as unknown as ProspectIntakeRow
}

export async function buildTemplateProvisionPayload(intake: IntakeRowForProvision) {
  const businessName = intake.business_name?.trim() || 'Your Business'
  const services =
    intake.services && intake.services.length > 0
      ? intake.services.filter((s) => s !== 'Other (describe below)')
      : ['Walk-In Closets']
  // Order-industry businesses (see EngagementModel) — priced menu items
  // entered on the intake's "Menu Items" step, seeded into the menu_items
  // table at provisioning time (provisionTenant.ts).
  const menuItems = Array.isArray(rowAsProspect(intake).menu_items)
    ? rowAsProspect(intake).menu_items
    : []

  const presentation = await resolveSitePresentation(
    presentationFromIntakeRow(rowAsProspect(intake)),
    { useGemini: true }
  )

  const { config: quizConfig } = await generateQuizConfig(
    {
      industry: rowAsProspect(intake).industry,
      business_name: businessName,
      services,
      other_services: intake.other_services,
    },
    { useGemini: true }
  )

  // If the user picked a theme/layout in the review step, it's stored in
  // ai_site_config.presentation — honour that over the AI-resolved values.
  const storedPres = (intake as unknown as ProspectIntakeRow).ai_site_config as
    | Record<string, unknown>
    | null
  const userPres = storedPres?.presentation as
    | { theme?: string; layoutStyle?: string; source?: string; themeTokens?: ThemeTokenSelection }
    | undefined

  const theme = userPres?.theme ? coerceThemeSlug(userPres.theme) : presentation.theme
  const layoutStyle = userPres?.layoutStyle ? coerceLayoutSlug(userPres.layoutStyle) : presentation.layoutStyle
  // When the user's stored review-step choice still carries synthesized
  // tokens (they kept the AI-suggested last-resort look), honour those;
  // otherwise fall back to whatever the fresh resolution just synthesized.
  // A user override to a *different* real named theme naturally has no
  // themeTokens, so it renders with that theme's authentic hand-tuned style.
  const themeTokens = userPres?.source === 'user' ? userPres.themeTokens : presentation.themeTokens
  const heroImage = THEME_HERO[theme] || GENERIC_HERO
  const about =
    intake.notes?.trim() ||
    `${businessName} is a trusted local service provider — get in touch for a free estimate.`

  const products = services.map((serviceName) => {
    const catalogItem = getServiceCatalogEntry(serviceName)
    return {
      title: serviceName,
      image: catalogItem.image,
      description: catalogItem.description,
      details: {
        subtitle: 'Professional Service',
        longDescription: `Expert ${serviceName} delivered by ${businessName} — licensed, insured, and guaranteed.`,
        specifications: ['Licensed & insured', 'Free estimate', 'Satisfaction guaranteed'],
      },
    }
  })

  if (intake.other_services?.trim()) {
    products.push({
      title: intake.other_services.trim(),
      image: GENERIC_HERO,
      description: `Professional ${intake.other_services.trim()} service tailored to your needs.`,
      details: {
        subtitle: 'Custom Service',
        longDescription: intake.other_services.trim(),
        specifications: ['Consultation included', 'Licensed & insured', 'Free estimate'],
      },
    })
  }

  const aiSiteConfig = {
    theme,
    layoutStyle,
    defaultRoom: presentation.defaultRoom,
    themeTokens: themeTokens || null,
    engagementModel: presentation.engagementModel,
    presentation: {
      theme,
      layoutStyle,
      resolvedAt: new Date().toISOString(),
      rationale: presentation.rationale,
      source: presentation.source,
      themeTokens: themeTokens || undefined,
    },
    hero: { headline: `Welcome to ${businessName}`, backgroundImage: heroImage },
    about: { description: about },
    process: {
      title: 'How We Work',
      subtitle: 'Simple, Fast, and Done Right',
      steps: [
        { number: '01', title: 'Get in Touch', description: `Contact ${businessName} for a free consultation and estimate.` },
        { number: '02', title: 'We Diagnose & Plan', description: 'We assess the job and walk you through exactly what needs to be done.' },
        { number: '03', title: 'We Get It Done', description: 'Our team completes the work to the highest standard — on time and on budget.' },
      ],
    },
    quiz: quizConfig,
    products,
  }

  return {
    businessName,
    theme,
    layoutStyle,
    themeTokens: themeTokens || null,
    beforeAfterCategoryOverride: presentation.beforeAfterCategoryOverride,
    engagementModel: presentation.engagementModel,
    menuItems,
    ownerEmail: intake.notification_email || intake.contact_email || '',
    heroHeadline: `Welcome to ${businessName}`,
    aboutDescription: about,
    heroImage,
    // beforeImage intentionally omitted — provisionTenant.ts generates a
    // unique AI "before" image per site. Falls back to static placeholder
    // automatically if OPENAI_API_KEY is absent.
    services,
    intakeSetup: {
      contactEmail: intake.contact_email || undefined,
      contactPhone: intake.contact_phone || undefined,
      notificationEmail: intake.notification_email || undefined,
      notificationPhone: intake.notification_phone || undefined,
      streetAddress: intake.street_address || undefined,
      addressLocality: intake.address_locality || undefined,
      addressRegion: intake.address_region || undefined,
      postalCode: intake.postal_code || undefined,
      serviceArea: intake.service_area || undefined,
      primaryColorHex: intake.primary_color_hex || undefined,
      logoUrl: intake.logo_url || undefined,
      desiredDomain: intake.desired_domain || undefined,
      pricingNotes: intake.pricing_notes || undefined,
    },
    intakeId: intake.id,
    aiSiteConfig,
  }
}

/** @deprecated Use SERVICE_LABELS from catalog */
export const LEGACY_SERVICE_OPTIONS = SERVICE_LABELS

/** Hero lookup for all catalog themes */
export function themeHeroUrl(theme: string): string {
  if (THEME_SLUGS.includes(theme as (typeof THEME_SLUGS)[number])) {
    return THEME_HERO[theme] || GENERIC_HERO
  }
  return GENERIC_HERO
}
