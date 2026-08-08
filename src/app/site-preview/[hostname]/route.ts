import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { publicAppOrigin } from '@/lib/urls';

export const dynamic = 'force-dynamic';

type PreviewTenant = {
  business_name?: string | null;
  site_status?: string | null;
  site_configs?: unknown;
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ hostname: string }> }
) {
  const { hostname } = await params;
  const url = new URL(req.url);
  const bypassSecret =
    url.searchParams.get('admin_bypass') ||
    process.env.ADMIN_BYPASS_SECRET ||
    'admin_bypass_default_secret';

  const targetHost = decodeURIComponent(hostname || '').trim();
  if (!targetHost) {
    return NextResponse.redirect(new URL('/admin/sites', req.url));
  }

  // Candidate URLs for custom-closets-websites upstream Vercel deployment:
  // 1. Direct host target (e.g. https://wikidos-pediatrics.ditchtheform.com) — bypasses Vercel preview deployment login wall!
  // 2. Configured custom sites URL / environment override
  // 3. Fallback vercel.app deployment URL
  const hostOrigin = targetHost.startsWith('http') ? targetHost : `https://${targetHost}`;

  const candidateUrls = [
    hostOrigin,
    process.env.CUSTOM_SITES_URL,
    process.env.NEXT_PUBLIC_WEBSITES_URL,
    'https://custom-closets-websites.vercel.app',
  ]
    .filter(Boolean)
    .map((u) => u!.replace(/\/$/, ''));

  // 1. Attempt proxy fetch from upstream website rendering engine
  for (const sitesBaseUrl of candidateUrls) {
    try {
      const targetUrl = sitesBaseUrl.includes(targetHost)
        ? `${sitesBaseUrl}/?admin_bypass=${encodeURIComponent(bypassSecret)}`
        : `${sitesBaseUrl}/${encodeURIComponent(targetHost)}?admin_bypass=${encodeURIComponent(bypassSecret)}`;

      const upstreamRes = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'DitchTheForm-AdminPreviewProxy/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        cache: 'no-store',
      });

      if (upstreamRes.ok) {
        const html = await upstreamRes.text();
        const isVercelAuthPage =
          html.includes('Log in to Vercel') ||
          html.includes('Continue with Google') ||
          html.includes('Continue with GitHub') ||
          html.includes('Vercel Authentication');
        const is404Page =
          html.includes('This page could not be found') ||
          html.includes('404: This page could not be found');

        if (html && !isVercelAuthPage && !is404Page && html.length > 500) {
          // Inject <base href="..."> into <head> so relative assets load cleanly
          let proxiedHtml = html;
          if (proxiedHtml.includes('<head>')) {
            proxiedHtml = proxiedHtml.replace('<head>', `<head><base href="${hostOrigin}/">`);
          } else if (proxiedHtml.includes('<head ')) {
            proxiedHtml = proxiedHtml.replace(/<head[^>]*>/, `$&<base href="${hostOrigin}/">`);
          }

          return new NextResponse(proxiedHtml, {
            status: 200,
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-store, max-age=0',
            },
          });
        }
      }
    } catch (err) {
      console.warn(`[site-preview-proxy] Upstream fetch failed for ${sitesBaseUrl}:`, err);
    }
  }

  // 2. Fallback: query Supabase directly and render an Admin Site Details & Preview Shell
  const supabase = getSupabaseAdmin();
  const prefix = targetHost.split('.')[0];

  const { data: domainRows } = await supabase
    .from('domains')
    .select('tenant_id, hostname, tenants(id, business_name, owner_email, site_status, site_configs(*))')
    .or(`hostname.eq.${targetHost},hostname.ilike.${prefix}%`)
    .limit(5);

  const matched = (domainRows || [])[0];
  const tenant = (matched?.tenants as unknown as PreviewTenant | null) || null;
  const configs = tenant?.site_configs;
  const config = Array.isArray(configs) ? configs[0] : configs;
  const businessName = tenant?.business_name || matched?.hostname || targetHost;
  const directSubdomainUrl = `https://${targetHost}/?admin_bypass=${bypassSecret}`;

  const fallbackHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${businessName} — Admin Site Preview</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-zinc-950 text-white min-h-screen p-8 flex flex-col items-center justify-center font-sans">
  <div class="max-w-2xl w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl text-center space-y-6">
    <div class="w-16 h-16 bg-purple-500/20 text-purple-400 rounded-2xl flex items-center justify-center mx-auto text-3xl font-bold">
      ✨
    </div>
    <div>
      <h1 class="text-3xl font-bold text-white">${businessName}</h1>
      <p class="text-zinc-400 text-sm mt-1">Platform Host: <code class="text-purple-300 font-mono">${targetHost}</code></p>
    </div>

    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
      Site Status: ${tenant?.site_status || 'active'}
    </div>
    
    ${
      config
        ? `
    <div class="bg-zinc-950 border border-zinc-800 rounded-xl p-6 text-left space-y-4 text-sm">
      <div>
        <span class="text-zinc-500 uppercase text-xs font-bold tracking-wider block">Theme / Voice</span>
        <span class="text-amber-300 font-medium">${config.theme || 'Default'}</span>
      </div>
      <div>
        <span class="text-zinc-500 uppercase text-xs font-bold tracking-wider block">Hero Headline</span>
        <span class="text-zinc-200 font-semibold text-base">${config.hero_config?.headline || 'Welcome'}</span>
      </div>
      <div>
        <span class="text-zinc-500 uppercase text-xs font-bold tracking-wider block">About Description</span>
        <span class="text-zinc-300">${config.about_config?.description || 'N/A'}</span>
      </div>
    </div>
    `
        : `
    <div class="bg-zinc-950 border border-zinc-800 rounded-xl p-6 text-center text-zinc-400 text-sm">
      Site configuration loaded from database.
    </div>
    `
    }

    <div class="bg-purple-950/40 border border-purple-800/50 rounded-xl p-4 text-left text-xs text-purple-200 space-y-2">
      <p class="font-semibold text-purple-300 text-sm">⚙️ Live Subdomain Available:</p>
      <p class="opacity-90">Click below to view the live website directly on its subdomain.</p>
    </div>

    <div class="pt-4 border-t border-zinc-800 flex flex-col gap-3 sm:flex-row sm:justify-center">
      <a href="${directSubdomainUrl}" target="_blank" rel="noopener noreferrer" class="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold text-sm transition-colors shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2">
        <span>🔍 Open Direct Subdomain Site</span>
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
      </a>
      <a href="${publicAppOrigin()}/admin/intakes" class="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg font-medium text-sm transition-colors flex items-center justify-center">
        ← Back to Admin Intakes
      </a>
    </div>
  </div>
</body>
</html>`;

  return new NextResponse(fallbackHtml, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
