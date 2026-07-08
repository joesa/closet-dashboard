import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { requireAdmin, logAdminAction } from '@/lib/admin'
import { coerceDesignVariant } from '@/lib/catalog/designVariantCatalog'
import { revalidateTenantSiteCache } from '@/lib/tenants/revalidateTenantSite'

/**
 * Admin override for a site's design variant ("studio style").
 * Stores a forced preset id on site_configs.design_variant, or null for the
 * default per-site seeded selection. The tenant renderer reads this column and
 * forces the matching preset; null falls back to procedural composition.
 */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin()

    const formData = await req.formData()
    const tenantId = formData.get('tenantId') as string | null
    const rawVariant = formData.get('designVariant') as string | null

    if (!tenantId) {
      return NextResponse.redirect(new URL('/admin/sites', req.url), 303)
    }

    const designVariant = coerceDesignVariant(rawVariant)

    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('site_configs')
      .update({ design_variant: designVariant })
      .eq('tenant_id', tenantId)

    if (error) throw error

    // Make the new studio style visible on the tenant site immediately
    // (best-effort; the site's config cache self-heals within 60s anyway).
    await revalidateTenantSiteCache(tenantId)

    await logAdminAction({
      actor: admin,
      action: 'site.design_variant',
      targetType: 'tenant',
      targetId: tenantId,
      metadata: { designVariant: designVariant ?? 'auto' },
    })

    return NextResponse.redirect(new URL(`/admin/sites/${tenantId}?saved=variant`, req.url), 303)
  } catch (error) {
    console.error('Update design variant error:', error)
    return NextResponse.redirect(new URL('/admin/sites?error=variant', req.url), 303)
  }
}
