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
    
    const { error } = await supabase
      .from('tenants')
      .update({ site_status: 'active' })
      .eq('id', tenantId);

    if (error) throw error;

    // Redirect back to admin dashboard
    return NextResponse.redirect(new URL('/admin/sites', req.url), 303);
  } catch (error) {
    console.error('Approve site error:', error);
    return NextResponse.redirect(new URL('/admin/sites?error=true', req.url), 303);
  }
}
