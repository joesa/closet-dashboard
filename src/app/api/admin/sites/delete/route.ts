import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin, logAdminAction } from '@/lib/admin';
import { teardownTenantData } from '@/lib/provision/teardownTenantData';

export async function POST(req: Request) {
  try {
    // Admin-only. requireAdmin() throws a redirect to /login for non-admins.
    const admin = await requireAdmin();

    const formData = await req.formData();
    const tenantId = formData.get('tenantId') as string;

    if (!tenantId) {
      return NextResponse.redirect(new URL('/admin/sites', req.url));
    }

    const supabase = getSupabaseAdmin();
    
    // Tear down all child tables (service_catalog, service_ux_defaults, site_configs, domains, etc.)
    // to guarantee safe deletion without foreign key constraint errors.
    await teardownTenantData(supabase, tenantId);

    await logAdminAction({
      actor: admin,
      action: 'site.delete',
      targetType: 'tenant',
      targetId: tenantId,
    });

    // Redirect back to admin dashboard
    return NextResponse.redirect(new URL('/admin/sites', req.url), 303);
  } catch (error) {
    console.error('Delete site error:', error);
    return NextResponse.redirect(new URL('/admin/sites?error=true', req.url), 303);
  }
}
