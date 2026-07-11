import React from 'react';
import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { buildTenantPreviewUrlFromDomains, getTenantLaunchSiteUrl } from '@/lib/admin-preview';
import { notFound } from 'next/navigation';
import DeleteTenantDialog from '@/components/DeleteTenantDialog';
import SiteValidationPanel from '@/components/SiteValidationPanel';
import AdminSiteChat from '@/components/AdminSiteChat';
import DomainManager from '@/components/DomainManager';
import { DESIGN_VARIANT_OPTIONS } from '@/lib/catalog/designVariantCatalog';
import { formatUsdCents } from '@/lib/domains/types';

export const dynamic = 'force-dynamic';

type SiteConfigShape = {
  theme?: string;
  default_room?: string;
  design_variant?: string | null;
  engagement_model?: string | null;
  hero_config?: { headline?: string; backgroundImage?: string } & Record<string, unknown>;
  about_config?: { description?: string } & Record<string, unknown>;
  products_config?: { image?: string; title?: string; description?: string }[];
};

type DomainShape = {
  hostname?: string;
  is_primary?: boolean;
  source?: string;
  ssl_status?: string;
  vercel_verified?: boolean;
  purchase_price_cents?: number | null;
  registrar_order_id?: string | null;
  expires_at?: string | null;
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
      validation_status,
      validation_report,
      validated_at,
      domains (
        hostname,
        is_primary,
        source,
        ssl_status,
        vercel_verified,
        purchase_price_cents,
        registrar_order_id,
        expires_at
      ),
      site_configs (
        theme,
        default_room,
        design_variant,
        engagement_model,
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

  const domainRows: DomainShape[] = Array.isArray(tenant.domains)
    ? (tenant.domains as DomainShape[])
    : tenant.domains
      ? [tenant.domains as DomainShape]
      : [];
  const primaryDomain =
    domainRows.find((d) => d.is_primary)?.hostname ||
    domainRows[0]?.hostname;
  const purchased = domainRows.filter((d) => d.source === 'purchased');

  // Preview/bypass must use a reachable host (platform *.localhost locally),
  // not an unpurchased custom primary that returns NXDOMAIN.
  const previewUrl = buildTenantPreviewUrlFromDomains(
    domainRows
      .filter((d): d is DomainShape & { hostname: string } => Boolean(d.hostname))
      .map((d) => ({
        hostname: d.hostname,
        source: d.source,
        is_primary: d.is_primary,
        vercel_verified: d.vercel_verified,
        ssl_status: d.ssl_status,
      }))
  );
  const launchUrlRaw = getTenantLaunchSiteUrl(
    domainRows
      .filter((d): d is DomainShape & { hostname: string } => Boolean(d.hostname))
      .map((d) => ({
        hostname: d.hostname,
        source: d.source,
        is_primary: d.is_primary,
        vercel_verified: d.vercel_verified,
        ssl_status: d.ssl_status,
      })),
    { launchPaid: tenant.site_status === 'active' }
  );
  const liveUrl =
    launchUrlRaw !== '#' && !launchUrlRaw.includes('.localhost') ? launchUrlRaw : null;

  const config = (Array.isArray(tenant.site_configs) && tenant.site_configs.length > 0 
    ? tenant.site_configs[0]
    : tenant.site_configs) as unknown as SiteConfigShape | null;

  const validationStatus = (tenant.validation_status ?? null) as 'pending' | 'passed' | 'failed' | null;
  const validationIssues = Array.isArray(tenant.validation_report) ? tenant.validation_report : [];
  const readyForApproval = validationStatus === 'passed';

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
                <span>{primaryDomain || 'No Domain Assigned'}</span>
                <span>•</span>
                <span>{tenant.owner_email}</span>
              </div>
              {purchased.length > 0 && (
                <p className="text-xs text-amber-200/80 mt-2">
                  Purchased domain cost (platform / maintenance fold-in):{' '}
                  {purchased
                    .map(
                      (d) =>
                        `${d.hostname} ${formatUsdCents(d.purchase_price_cents)}/yr`
                    )
                    .join(' · ')}
                </p>
              )}
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
              {tenant.site_status === 'pending_approval' && !readyForApproval && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                  Needs Fixes
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 flex flex-wrap gap-4 items-center">
          {liveUrl ? (
            <a
              href={liveUrl}
              target="_blank"
              rel="noreferrer"
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              Visit live site
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ) : null}
          {previewUrl ? (
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20"
            >
              {tenant.site_status !== 'active' ? 'Preview Customer Unapprove Site' : 'Review Staging View'}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ) : (
            <span className="text-sm text-neutral-500">
              Set ADMIN_BYPASS_SECRET to enable staging preview
            </span>
          )}
          
          {tenant.site_status === 'pending_approval' && readyForApproval && (
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
          {tenant.site_status === 'pending_approval' && !readyForApproval && (
            <span className="text-sm text-neutral-500">
              Resolve validation issues below before this site can be approved.
            </span>
          )}

          <div className="ml-auto">
            <DeleteTenantDialog tenantId={tenant.id} businessName={tenant.business_name} variant="detail" />
          </div>
        </div>

        {/* Site Validation Gate */}
        <SiteValidationPanel
          tenantId={tenant.id}
          status={validationStatus}
          issues={validationIssues}
          validatedAt={tenant.validated_at ?? null}
        />

        {/* AI Site Assistant — conversational edits to this site's config */}
        <AdminSiteChat tenantId={tenant.id} previewUrl={previewUrl} />

        {/* Domain management — BYO + Vercel purchase (admin override) */}
        <DomainManager tenantId={tenant.id} showAdminCost variant="admin" />

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
                  <div>
                    <span className="text-neutral-400 text-sm block mb-1">Engagement Model</span>
                    <div className={`font-mono px-3 py-2 rounded inline-block ${config.engagement_model === 'order' ? 'bg-purple-500/10 text-purple-300' : 'bg-black/50 text-blue-400'}`}>
                      {config.engagement_model === 'order' ? 'order (menu \u2192 cart \u2192 submit)' : 'quote (estimate \u2192 lead capture)'}
                    </div>
                  </div>
                  <div>
                    <span className="text-neutral-400 text-sm block mb-1">Studio Style (Design Variant)</span>
                    <form action="/api/admin/sites/design-variant" method="POST" className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="tenantId" value={tenant.id} />
                      <select
                        name="designVariant"
                        defaultValue={config.design_variant ?? ''}
                        className="bg-black/50 border border-neutral-700 text-white text-sm rounded px-3 py-2 font-mono"
                      >
                        {DESIGN_VARIANT_OPTIONS.map((opt) => (
                          <option key={opt.id || 'auto'} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded transition-colors"
                      >
                        Save
                      </button>
                    </form>
                    <p className="text-neutral-500 text-xs mt-2">
                      &ldquo;Auto&rdquo; gives every site a unique seeded layout. Pick a preset to force a specific look, then use Preview to review.
                    </p>
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
