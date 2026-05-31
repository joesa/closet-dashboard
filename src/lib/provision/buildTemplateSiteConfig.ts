import type { IntakeRowForProvision } from '@/lib/provision/types'

export const VIBE_TO_THEME: Record<string, string> = {
  'Luxury & minimal': 'luxury-minimal',
  'Bold & industrial': 'brutalist',
  'Warm & classic': 'classic-warm',
  'Modern & clean': 'modern-office',
  'Playful & friendly': 'playful-kids',
  'Rustic & natural': 'rustic-pantry',
  'Elegant & refined': 'elegant-dressing',
  'Sleek & high-tech': 'sleek-entertainment',
}

const SERVICE_CATALOG: Record<string, { image: string; description: string }> = {
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

const THEME_HERO: Record<string, string> = {
  'luxury-minimal': 'https://images.unsplash.com/photo-1558211583-d26f610c1eb1',
  brutalist: 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81',
  'classic-warm': 'https://images.unsplash.com/photo-1556910103-1c02745a872f',
  'modern-office': 'https://images.unsplash.com/photo-1524758631624-e2822e304c36',
  'playful-kids': 'https://images.unsplash.com/photo-1505693314120-0d443867891c',
  'rustic-pantry': 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a',
  'sleek-entertainment': 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5',
  'elegant-dressing': 'https://images.unsplash.com/photo-1595428774223-ef52624120d2',
}

const GENERIC_HERO = 'https://images.unsplash.com/photo-1558211583-d26f610c1eb1'

export type TemplateSiteParams = {
  businessName: string
  theme: string
  layoutStyle?: string
  services: string[]
  intake: IntakeRowForProvision
}

export function buildTemplateProvisionPayload(intake: IntakeRowForProvision) {
  const businessName = intake.business_name?.trim() || 'Your Business'
  const theme = (intake.vibe && VIBE_TO_THEME[intake.vibe]) || 'luxury-minimal'
  const services =
    intake.services && intake.services.length > 0
      ? intake.services
      : ['Walk-In Closets']

  const heroImage = THEME_HERO[theme] || GENERIC_HERO
  const about =
    intake.notes?.trim() ||
    `${businessName} provides premium custom storage solutions tailored to your life.`

  const products = services.map((serviceName) => {
    const catalogItem = SERVICE_CATALOG[serviceName] || {
      image: GENERIC_HERO,
      description: 'Premium custom storage solution.',
    }
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

  return {
    businessName,
    theme,
    layoutStyle: 'standard' as const,
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
    aiSiteConfig: {
      theme,
      defaultRoom: services[0] || 'Custom Space',
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
    },
  }
}
