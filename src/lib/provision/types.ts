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
  industry?: string | null
  services?: string[]
  primary_cta?: string | null
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
  other_services?: string | null
  vibe?: string | null
  tone?: string | null
  customers?: string | null
  experience?: string | null
  primary_cta?: string | null
  notes?: string | null
  requested_product?: string | null
  industry?: string | null
}

export type ProvisionTenantInput = {
  businessName: string
  theme?: string
  layoutStyle?: string
  /**
   * True when `theme` was auto-resolved (rules/AI recommendation kept as-is)
   * rather than deliberately chosen by an operator. When set, provisioning may
   * rebalance the theme across the industry pool to guarantee two same-trade
   * sites don't collide — even if both are created before either deploys. A
   * deliberate admin/AI theme choice (flag false/absent) is always respected.
   */
  themeAutoResolved?: boolean
  /**
   * Optional synthesized "last-resort" theme look (surface/shape/voice/swatch
   * IDs). When present, the renderer composes styling from these tokens
   * instead of `theme`'s hand-tuned definition. See ThemeTokenSelection in
   * custom-closets-websites/src/lib/theme.ts.
   */
  themeTokens?: { surface: string; shape: string; voice: string; swatch: string } | null
  /**
   * Before/after image subject category from a matching contractor-created
   * custom industry (see @/lib/catalog/customIndustries), when the business's
   * industry isn't in the static catalog. Overrides the static
   * INDUSTRY_BEFORE_AFTER_CATEGORY guess in openai-images.ts.
   */
  beforeAfterCategoryOverride?: 'vehicle' | 'exterior' | 'fixture' | 'pet' | 'interior-space' | 'not-applicable'
  /**
   * Deterministic quote-vs-order detection (see EngagementModel in
   * catalog/types.ts) — resolved once at provisioning time from the
   * business's industry and stored on site_configs so the renderer knows
   * which widget/section to show. Defaults to 'quote' when absent.
   */
  engagementModel?: 'quote' | 'order' | 'booking' | 'ticket'
  /**
   * Priced menu items entered on the intake's "Menu Items" step (order-
   * industry businesses only) — seeded into the menu_items table at
   * provisioning time.
   */
  menuItems?: Array<{ name: string; price: number; category?: string }>
  /** Optional forced design-variant preset id; null/empty = seeded Auto. */
  designVariant?: string | null
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
