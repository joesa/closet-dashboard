import Link from 'next/link';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  buildTenantPreviewUrlFromDomains,
  getTenantLaunchSiteUrl,
} from '@/lib/admin-preview';
import DeleteTenantDialog from '@/components/DeleteTenantDialog';

export const dynamic = 'force-dynamic';

export default async function AdminSitesPage() {
  const supabase = getSupabaseAdmin();
  
  const { data: tenants, error } = await supabase
    .from('tenants')
    .select(`
      id,
      business_name,
      owner_email,
      site_status,
      created_at,
      validation_status,
      domains ( hostname, source, is_primary, vercel_verified, ssl_status )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return <div className="p-8 text-white">Error loading sites.</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Sites</h1>
        <p className="text-neutral-400 mb-8">Manage tenant websites, approve pending deployments, and review active sites.</p>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-900 border-b border-neutral-800 text-neutral-400">
              <tr>
                <th className="px-6 py-4 font-medium uppercase tracking-widest text-xs">Business Name</th>
                <th className="px-6 py-4 font-medium uppercase tracking-widest text-xs">Domain</th>
                <th className="px-6 py-4 font-medium uppercase tracking-widest text-xs">Owner</th>
                <th className="px-6 py-4 font-medium uppercase tracking-widest text-xs">Status</th>
                <th className="px-6 py-4 font-medium uppercase tracking-widest text-xs text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {tenants?.map((tenant) => {
                const domainRows = Array.isArray(tenant.domains)
                  ? tenant.domains
                  : tenant.domains
                    ? [tenant.domains as {
                        hostname?: string
                        source?: string
                        is_primary?: boolean
                        vercel_verified?: boolean
                        ssl_status?: string
                      }]
                    : [];
                const mappedDomains = domainRows.map((d) => ({
                  hostname: d.hostname || '',
                  source: d.source,
                  is_primary: d.is_primary,
                  vercel_verified: d.vercel_verified,
                  ssl_status: d.ssl_status,
                }));
                const displayDomain =
                  domainRows.find((d) => d.is_primary)?.hostname ||
                  domainRows[0]?.hostname;
                const previewUrl = buildTenantPreviewUrlFromDomains(mappedDomains);
                const launchUrl = getTenantLaunchSiteUrl(mappedDomains, {
                  launchPaid: tenant.site_status === 'active',
                });
                const liveUrl =
                  launchUrl !== '#' && !launchUrl.includes('.localhost') ? launchUrl : null;

                return (
                  <tr key={tenant.id} className="hover:bg-neutral-800/50 transition-colors group">
                    <td className="px-6 py-4 font-medium">
                      <Link href={`/admin/sites/${tenant.id}`} className="hover:text-blue-400 hover:underline">
                        {tenant.business_name}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-neutral-400">
                      {displayDomain || 'No Domain'}
                    </td>
                    <td className="px-6 py-4 text-neutral-400">
                      {tenant.owner_email}
                    </td>
                    <td className="px-6 py-4">
                      {tenant.site_status === 'active' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Active
                        </span>
                      )}
                      {tenant.site_status === 'pending_approval' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Pending Approval
                        </span>
                      )}
                      {tenant.site_status === 'pending_approval' && tenant.validation_status === 'failed' && (
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                          Needs Fixes
                        </span>
                      )}
                      {tenant.site_status === 'suspended' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                          Suspended
                        </span>
                      )}
                      {tenant.site_status === 'widget_only' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
                          Widget Only
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-3">
                      <Link 
                        href={`/admin/sites/${tenant.id}`}
                        className="text-xs font-medium text-neutral-400 hover:text-white transition-colors uppercase tracking-wider"
                      >
                        Details
                      </Link>

                      {liveUrl ? (
                        <a
                          href={liveUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors uppercase tracking-wider"
                        >
                          Live
                        </a>
                      ) : null}

                      {previewUrl ? (
                        <a
                          href={previewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-wider"
                        >
                          {tenant.site_status !== 'active' ? 'Preview Customer Unapprove Site' : 'Review'}
                        </a>
                      ) : (
                        <span
                          className="text-xs text-neutral-500 uppercase tracking-wider"
                          title="Set ADMIN_BYPASS_SECRET to enable preview"
                        >
                          Preview N/A
                        </span>
                      )}
                      
                      {tenant.site_status === 'pending_approval' && (
                        <form className="inline-block" action={`/api/admin/sites/approve`} method="POST">
                          <input type="hidden" name="tenantId" value={tenant.id} />
                          <button 
                            type="submit"
                            className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors uppercase tracking-wider"
                          >
                            Approve
                          </button>
                        </form>
                      )}

                      <DeleteTenantDialog tenantId={tenant.id} businessName={tenant.business_name} variant="table" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {(!tenants || tenants.length === 0) && (
            <div className="p-8 text-center text-neutral-500">
              No tenants found. Create one in the sandbox.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
