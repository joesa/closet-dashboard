import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Collect distinct emails linked to a phone across widget leads and scraper leads.
 * Used by Twilio STOP → suppress related emails.
 */
export async function findEmailsByPhone(
  admin: SupabaseClient,
  phone: string
): Promise<string[]> {
  const emails = new Set<string>()

  const [widgetRes, scraperRes] = await Promise.all([
    admin.from('leads').select('email').eq('phone', phone).not('email', 'is', null),
    admin
      .from('scraper_leads')
      .select('email')
      .eq('phone', phone)
      .not('email', 'is', null),
  ])

  for (const row of widgetRes.data ?? []) {
    if (row.email) emails.add(row.email)
  }
  for (const row of scraperRes.data ?? []) {
    if (row.email) emails.add(row.email)
  }

  return [...emails]
}

/**
 * Collect distinct phones linked to an email (widget + scraper).
 */
export async function findPhonesByEmail(
  admin: SupabaseClient,
  email: string
): Promise<string[]> {
  const phones = new Set<string>()

  const [widgetRes, scraperRes] = await Promise.all([
    admin.from('leads').select('phone').eq('email', email).not('phone', 'is', null),
    admin
      .from('scraper_leads')
      .select('phone')
      .eq('email', email)
      .not('phone', 'is', null),
  ])

  for (const row of widgetRes.data ?? []) {
    if (row.phone) phones.add(row.phone)
  }
  for (const row of scraperRes.data ?? []) {
    if (row.phone) phones.add(row.phone)
  }

  return [...phones]
}
