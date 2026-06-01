import type { IntakeRowForProvision } from '@/lib/provision/types'
import {
  presentationFromIntakeRow,
  resolveSitePresentation,
} from '@/lib/ai/resolveSitePresentation'
import type { ProspectIntakeRow } from '@/lib/intake/getIntakeByToken'
import {
  getServiceCatalogEntry,
  SERVICE_LABELS,
} from '@/lib/catalog/contractorServices'
import { THEME_SLUGS } from '@/lib/catalog/sitePresentationCatalog'

export { VIBE_TO_THEME } from '@/lib/catalog/sitePresentationCatalog'

const THEME_HERO: Record<string, string> = {
  'luxury-minimal': 'https://images.unsplash.com/photo-1558211583-d26f610c1eb1',
  brutalist: 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81',
  'classic-warm': 'https://images.unsplash.com/photo-1556910103-1c02745a872f',
  'modern-office': 'https://images.unsplash.com/photo-1524758631624-e2822e304c36',
  'playful-kids': 'https://images.unsplash.com/photo-1505693314120-0d443867891c',
  'rustic-pantry': 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a',
  'sleek-entertainment': 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5',
  'elegant-dressing': 'https://images.unsplash.com/photo-1595428774223-ef52624120d2',
  'functional-utility': 'https://images.unsplash.com/photo-1558211583-d26f610c1eb1',
  'creative-craft': 'https://images.unsplash.com/photo-1452860607046-6d350d744276',
  'sophisticated-wine': 'https://images.unsplash.com/photo-1556910103-1c02745a872f',
  'cozy-library': 'https://images.unsplash.com/photo-1507842217343-583bb7270b66',
  'minimalist-zen': 'https://images.unsplash.com/photo-1558211583-d26f610c1eb1',
  'garage-industrial': 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81',
  'pantry-fresh': 'https://images.unsplash.com/photo-1556910103-1c02745a872f',
  'laundry-clean': 'https://images.unsplash.com/photo-1585429371326-7f264a7de3d0',
  'mudroom-family': 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a',
  'commercial-pro': 'https://images.unsplash.com/photo-1497366216548-37526070297c',
  'coastal-climate': 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81',
  'historic-classic': 'https://images.unsplash.com/photo-1556910103-1c02745a872f',
  'luxury-gallery': 'https://images.unsplash.com/photo-1558211583-d26f610c1eb1',
  'kids-playful': 'https://images.unsplash.com/photo-1505693314120-0d443867891c',
  'media-theater': 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5',
  'office-executive': 'https://images.unsplash.com/photo-1524758631624-e2822e304c36',
  'wine-cellar': 'https://images.unsplash.com/photo-1556910103-1c02745a872f',
}

const GENERIC_HERO = 'https://images.unsplash.com/photo-1558211583-d26f610c1eb1'

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

  const presentation = await resolveSitePresentation(
    presentationFromIntakeRow(rowAsProspect(intake)),
    { useGemini: true }
  )

  const theme = presentation.theme
  const layoutStyle = presentation.layoutStyle
  const heroImage = THEME_HERO[theme] || GENERIC_HERO
  const about =
    intake.notes?.trim() ||
    `${businessName} provides premium custom storage solutions tailored to your life.`

  const products = services.map((serviceName) => {
    const catalogItem = getServiceCatalogEntry(serviceName)
    return {
      title: serviceName,
      image: catalogItem.image,
      description: catalogItem.description,
      details: {
        subtitle: 'Bespoke Design',
        longDescription: `Full architectural build out for your ${serviceName}.`,
        specifications: ['Premium Materials', 'Precision Fit', 'Lifetime Warranty'],
      },
    }
  })

  if (intake.other_services?.trim()) {
    products.push({
      title: intake.other_services.trim(),
      image: GENERIC_HERO,
      description: 'Custom storage tailored to your space.',
      details: {
        subtitle: 'Custom',
        longDescription: intake.other_services.trim(),
        specifications: ['Consultation included', 'Precision fit', 'Professional install'],
      },
    })
  }

  const aiSiteConfig = {
    theme,
    layoutStyle,
    defaultRoom: presentation.defaultRoom,
    presentation: {
      theme,
      layoutStyle,
      resolvedAt: new Date().toISOString(),
      rationale: presentation.rationale,
      source: presentation.source,
    },
    hero: { headline: `Welcome to ${businessName}`, backgroundImage: heroImage },
    about: { description: about },
    process: {
      title: 'Our Process',
      subtitle: 'How we work',
      steps: [
        { number: '01', title: 'Consultation', description: 'We meet with you.' },
        { number: '02', title: 'Design', description: 'We design it.' },
        { number: '03', title: 'Install', description: 'We build it.' },
      ],
    },
    products,
  }

  return {
    businessName,
    theme,
    layoutStyle,
    ownerEmail: intake.notification_email || intake.contact_email || '',
    heroHeadline: `Welcome to ${businessName}`,
    aboutDescription: about,
    heroImage,
    beforeImage: '/brands/lumina/before.png',
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
