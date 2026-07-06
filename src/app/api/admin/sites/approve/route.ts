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

    const { data: tenant, error: loadError } = await supabase
      .from('tenants')
      .select('validation_status')
      .eq('id', tenantId)
      .maybeSingle();
    if (loadError) throw loadError;

    // Site-validation gate: don't allow approval until the automated QA
    // battery (theme/layout consistency, nav presence, broken links/images,
    // bespoke/duplicate design) has passed. Enforced server-side too, not
    // just by hiding the button, since this is a real safety gate.
    if (tenant?.validation_status !== 'passed') {
      return NextResponse.redirect(
        new URL(`/admin/sites/${tenantId}?error=validation_required`, req.url),
        303
      );
    }

    const { error } = await supabase
      .from('tenants')
      .update({ site_status: 'active' })
      .eq('id', tenantId);

    if (error) throw error;

    await logAdminAction({
      actor: admin,
      action: 'site.approve',
      targetType: 'tenant',
      targetId: tenantId,
    });

    // Redirect back to admin dashboard
    return NextResponse.redirect(new URL('/admin/sites', req.url), 303);
  } catch (error) {
    console.error('Approve site error:', error);
    return NextResponse.redirect(new URL('/admin/sites?error=true', req.url), 303);
  }
}
