import React from 'react';
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { buildTenantPreviewUrl, getTenantPublicUrl } from '@/lib/admin-preview';
import { notFound } from 'next/navigation';
import DeleteTenantDialog from '@/components/DeleteTenantDialog';

export const dynamic = 'force-dynamic';

type SiteConfigShape = {
  theme?: string;
  default_room?: string;
  hero_config?: { headline?: string; backgroundImage?: string } & Record<string, unknown>;
  about_config?: { description?: string } & Record<string, unknown>;
  products_config?: { image?: string; title?: string; description?: string }[];
};

export default async function TenantDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const tenantId = resolvedParams.id;
  const supabase = getSupabaseAdmin();
  
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select(`
      id,
      business_name,
      owner_email,
      site_status,
      created_at,
      domains ( hostname ),
      site_configs (
        theme,
        default_room,
        hero_config,
        about_config,
        products_config
      )
    `)
    .eq('id', tenantId)
    .single();

  if (error || !tenant) {
    console.error(error);
    notFound();
  }

  const domain = Array.isArray(tenant.domains) && tenant.domains.length > 0 
    ? tenant.domains[0].hostname 
    : (tenant.domains as unknown as { hostname?: string } | null)?.hostname;
    
  const siteUrl = domain ? getTenantPublicUrl(domain) : '#';
  const previewUrl = buildTenantPreviewUrl(siteUrl);

  const config = (Array.isArray(tenant.site_configs) && tenant.site_configs.length > 0 
    ? tenant.site_configs[0]
    : tenant.site_configs) as unknown as SiteConfigShape | null;

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Breadcrumb & Header */}
        <div className="space-y-4">
          <Link href="/admin/sites" className="text-neutral-400 hover:text-white transition-colors text-sm flex items-center gap-2">
            <span>←</span> Back to Control Center
          </Link>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">{tenant.business_name}</h1>
              <div className="text-neutral-400 mt-1 flex items-center gap-3">
                <span>{domain || 'No Domain Assigned'}</span>
                <span>•</span>
                <span>{tenant.owner_email}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {tenant.site_status === 'active' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Live Active
                </span>
              )}
              {tenant.site_status === 'pending_approval' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                  Pending Approval
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 flex flex-wrap gap-4 items-center">
          {previewUrl ? (
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20"
            >
              Review Staging View
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ) : (
            <span className="text-sm text-neutral-500">
              Set ADMIN_BYPASS_SECRET to enable staging preview
            </span>
          )}
          
          {tenant.site_status === 'pending_approval' && (
            <form action={`/api/admin/sites/approve`} method="POST">
              <input type="hidden" name="tenantId" value={tenant.id} />
              <button 
                type="submit"
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors shadow-lg shadow-emerald-500/20"
              >
                Approve & Go Live
              </button>
            </form>
          )}

          <div className="ml-auto">
            <DeleteTenantDialog tenantId={tenant.id} businessName={tenant.business_name} variant="detail" />
          </div>
        </div>

        {/* Configuration Inspection */}
        {config ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Core & Copywriting */}
            <div className="space-y-8">
              <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
                <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4">Design System</h3>
                <div className="space-y-4">
                  <div>
                    <span className="text-neutral-400 text-sm block mb-1">Aesthetic Theme</span>
                    <div className="font-mono bg-black/50 px-3 py-2 rounded text-blue-400">
                      {config.theme}
                    </div>
                  </div>
                  <div>
                    <span className="text-neutral-400 text-sm block mb-1">Default Quote Room</span>
                    <div className="text-white">
                      {config.default_room}
                    </div>
                  </div>
                </div>
              </section>

              <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
                <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4">Copywriting</h3>
                <div className="space-y-4">
                  <div>
                    <span className="text-neutral-400 text-sm block mb-1">Hero Headline</span>
                    <div className="text-white text-lg font-medium leading-snug">
                      &ldquo;{config.hero_config?.headline}&rdquo;
                    </div>
                  </div>
                  <div>
                    <span className="text-neutral-400 text-sm block mb-1">About Us Story</span>
                    <div className="text-neutral-300 leading-relaxed text-sm bg-black/30 p-4 rounded-lg border border-neutral-800">
                      {config.about_config?.description}
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* Portfolio Grid Inspect */}
            <div className="space-y-8">
              <section className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
                <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4">
                  Mapped Services ({config.products_config?.length || 0})
                </h3>
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                  {config.products_config?.map((product: { image?: string; title?: string; description?: string }, i: number) => (
                    <div key={i} className="flex gap-4 p-4 rounded-lg bg-black/40 border border-neutral-800">
                      <div className="w-20 h-20 rounded bg-neutral-800 shrink-0 overflow-hidden relative">
                        {/* eslint-disable-next-line @next/next/no-img-element -- external/admin-preview image of arbitrary origin; next/image remotePatterns can't cover unknown tenant domains */}
                        <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <h4 className="font-medium text-white">{product.title}</h4>
                        <p className="text-sm text-neutral-400 mt-1 line-clamp-2">{product.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

          </div>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-12 text-center text-neutral-500">
            No site configuration found for this tenant.
          </div>
        )}

      </div>
    </div>
  );
}
