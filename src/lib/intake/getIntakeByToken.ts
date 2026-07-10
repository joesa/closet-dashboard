import { getSupabaseAdmin } from '@/lib/supabase-admin'

export type ProspectIntakeRow = {
  id: string
  token: string
  status: string
  source: string
  business_name: string | null
  contact_email: string | null
  verification_email: string | null
  email_verified_at: string | null
  requested_product: string
  provisioning_mode: string
  intake_tier: string
  tier_total_cents: number
  deposit_required_cents: number
  deposit_paid_cents: number
  deposit_status: string
  tier_selected_at: string | null
  stripe_checkout_session_id: string | null
  build_paid_at: string | null
  balance_paid_at: string | null
  maintenance_plan: string | null
  preview_approved_at: string | null
  site_live_at: string | null
  provisioned_contractor_id: string | null
  maintenance_started_at: string | null
  ai_site_config: Record<string, unknown> | null
  widget_config_hints: Record<string, unknown> | null
  image_selections: unknown
  services: string[]
  vibe: string | null
  tone: string | null
  customers: string | null
  experience: string | null
  differentiators: string[]
  primary_cta: string | null
  notes: string | null
  pricing_notes: string | null
  primary_color_hex: string | null
  logo_url: string | null
  contact_name: string | null
  contact_phone: string | null
  street_address: string | null
  address_locality: string | null
  address_region: string | null
  postal_code: string | null
  service_area: string | null
  notification_email: string | null
  notification_phone: string | null
  desired_domain: string | null
  /** When true, prospect asked platform to buy desired_domain (admin fulfills). */
  domain_purchase_requested: boolean
  other_services: string | null
  industry: string | null
  requested_pages: string[]
  gallery_images: string[]
  page_contents: Record<string, string>
  menu_items: Array<{ name: string; price: number; category?: string }>
}

const INTAKE_SELECT = `
  id, token, status, source, business_name, contact_email, email_verified_at,
  verification_email,
  requested_product, provisioning_mode,
  intake_tier, tier_total_cents, deposit_required_cents, deposit_paid_cents,
  deposit_status, stripe_checkout_session_id, tier_selected_at,
  build_paid_at, balance_paid_at, maintenance_plan, preview_approved_at,
  site_live_at, provisioned_contractor_id, maintenance_started_at,
  ai_site_config, widget_config_hints, image_selections,
  services, vibe, tone, customers, experience, differentiators, primary_cta, notes,
  pricing_notes, primary_color_hex, logo_url, contact_name, contact_phone,
  street_address, address_locality, address_region, postal_code, service_area,
  notification_email, notification_phone, desired_domain, domain_purchase_requested,
  other_services, industry,
  requested_pages, gallery_images, page_contents, menu_items
`

export async function getIntakeByToken(token: string): Promise<ProspectIntakeRow | null> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('prospect_intakes')
    .select(INTAKE_SELECT)
    .eq('token', token)
    .maybeSingle()

  if (error || !data) return null
  return data as ProspectIntakeRow
}
