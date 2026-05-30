import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin, logAdminAction } from '@/lib/admin';

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
    
    // We rely on ON DELETE CASCADE for foreign keys in Supabase (if setup)
    // If not, we should delete site_configs and domains first.
    // Assuming cascading is setup or we manually do it here just in case:
    await supabase.from('site_configs').delete().eq('tenant_id', tenantId);
    await supabase.from('domains').delete().eq('tenant_id', tenantId);
    
    // Delete tenant
    const { error } = await supabase
      .from('tenants')
      .delete()
      .eq('id', tenantId);

    if (error) throw error;

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
