import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
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

    // Redirect back to admin dashboard
    return NextResponse.redirect(new URL('/admin/sites', req.url), 303);
  } catch (error) {
    console.error('Delete site error:', error);
    return NextResponse.redirect(new URL('/admin/sites?error=true', req.url), 303);
  }
}
