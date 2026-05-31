import { getSupabaseAdmin } from '@/lib/supabase-admin'

export function slugifySubdomain(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'site'
}

/**
 * Pick a unique platform subdomain slug; appends -2, -3 on collision.
 */
export async function resolveSubdomain(businessName: string): Promise<string> {
  const admin = getSupabaseAdmin()
  const base = slugifySubdomain(businessName)
  const baseDomain = (process.env.TENANT_BASE_DOMAIN || 'localhost').replace(/^\.+|\.+$/g, '')

  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`
    const hostname = `${slug}.${baseDomain}`
    const { data } = await admin
      .from('domains')
      .select('id')
      .eq('hostname', hostname)
      .maybeSingle()
    if (!data) return slug
  }

  return `${base}-${Date.now().toString(36).slice(-6)}`
}
