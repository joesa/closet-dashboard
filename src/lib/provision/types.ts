export type IntakeSetup = {
  contactEmail?: string
  contactPhone?: string
  notificationEmail?: string
  notificationPhone?: string
  streetAddress?: string
  addressLocality?: string
  addressRegion?: string
  postalCode?: string
  serviceArea?: string
  primaryColorHex?: string
  logoUrl?: string
  desiredDomain?: string
  pricingNotes?: string
}

export type IntakeRowForProvision = IntakeSetup & {
  id: string
  business_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  notification_email?: string | null
  notification_phone?: string | null
  street_address?: string | null
  address_locality?: string | null
  address_region?: string | null
  postal_code?: string | null
  service_area?: string | null
  primary_color_hex?: string | null
  logo_url?: string | null
  desired_domain?: string | null
  pricing_notes?: string | null
  services?: string[] | null
  vibe?: string | null
  notes?: string | null
  requested_product?: string | null
}

export type ProvisionTenantInput = {
  businessName: string
  theme?: string
  layoutStyle?: string
  subdomain?: string
  ownerEmail: string
  heroHeadline?: string
  aboutDescription?: string
  heroImage?: string
  beforeImage?: string
  services?: string[]
  aiSiteConfig?: Record<string, unknown> | null
  aiWidgetConfig?: Record<string, unknown> | null
  intakeSetup?: IntakeSetup
  intakeId?: string
  mode?: 'full' | 'widget'
  /** Full sites: pending_approval for auto jobs, active for manual admin builds */
  siteStatus?: 'active' | 'pending_approval' | 'widget_only' | 'suspended'
  loginOrigin: string
  sendWelcomeEmail?: boolean
  tenantId?: string
}

export type ProvisionTenantResult = {
  success: true
  mode: 'full' | 'widget'
  tenantId: string
  widgetId: string
  url: string | null
  domain: {
    platformHost: string
    customHost: string | null
    vercel: unknown
  } | null
  embedSnippet: string
  ownerEmail: string
  loginUrl: string
  tempPassword: string
  authUserId: string | null
}

export class ProvisionReviewError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProvisionReviewError'
  }
}
