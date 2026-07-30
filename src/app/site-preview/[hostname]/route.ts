import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { publicAppOrigin } from '@/lib/urls';

export const dynamic = 'force-dynamic';

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

  // Upstream website rendering engine host (custom-closets-websites Vercel deployment)
  const sitesBaseUrl = (
    process.env.CUSTOM_SITES_URL ||
    process.env.NEXT_PUBLIC_WEBSITES_URL ||
    'https://custom-closets-websites.vercel.app'
  ).replace(/\/$/, '');

  // 1. Attempt proxy fetch from custom-closets-websites upstream deployment
  try {
    const targetUrl = `${sitesBaseUrl}/${encodeURIComponent(targetHost)}?admin_bypass=${encodeURIComponent(bypassSecret)}`;
    const upstreamRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'DitchTheForm-AdminPreviewProxy/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      cache: 'no-store',
    });

    if (upstreamRes.ok) {
      const html = await upstreamRes.text();
      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, max-age=0',
        },
      });
    }
  } catch (err) {
    console.warn('[site-preview-proxy] Upstream fetch failed:', err);
  }

  // 2. Fallback: query Supabase directly and render an Admin Site Preview Shell
  const supabase = getSupabaseAdmin();

  // Try matching domains table first by hostname or subdomain prefix
  const prefix = targetHost.split('.')[0];
  const { data: domainRows } = await supabase
    .from('domains')
    .select('tenant_id, hostname, tenants(id, business_name, owner_email, site_status, site_configs(*))')
    .or(`hostname.eq.${targetHost},hostname.ilike.${prefix}%`)
    .limit(5);

  const matched = (domainRows || [])[0];
  const tenant = (matched?.tenants as any) || null;
  const configs = tenant?.site_configs;
  const config = Array.isArray(configs) ? configs[0] : configs;
  const businessName = tenant?.business_name || matched?.hostname || targetHost;

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
      <p class="text-zinc-400 text-sm mt-1">Host: <code class="text-purple-300 font-mono">${targetHost}</code></p>
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

    <div class="pt-4 border-t border-zinc-800 flex flex-col gap-3 sm:flex-row sm:justify-center">
      <a href="${publicAppOrigin()}/admin/sites" class="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg font-medium text-sm transition-colors">
        ← Back to Admin Sites
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
