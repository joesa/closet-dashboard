import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  buildTenantPreviewUrlFromDomains,
  isDevHostname,
  pickPreviewHostname,
  type PreviewDomainRow,
} from '@/lib/admin-preview'
import {
  sanitizeCustomConfig,
  WIDGET_PLACEHOLDER,
  type CustomSiteConfig,
} from '@/lib/customSite'

export type CloneEngineSiteResult = {
  draft: CustomSiteConfig
  source: 'published_custom' | 'live_html' | 'engine_config'
  warnings: string[]
  reply: string
  pageKeys: string[]
}

function esc(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function absUrl(src: string, origin: string): string {
  if (!src) return ''
  if (/^https?:\/\//i.test(src)) return src
  if (src.startsWith('//')) return `https:${src}`
  try {
    return new URL(src, origin).toString()
  } catch {
    return src
  }
}

/** Rewrite Next image optimizer URLs to the underlying asset URL. */
function rewriteNextImageUrls(html: string, origin: string): string {
  return html.replace(
    /src="(\/_next\/image\?[^"]+)"/gi,
    (_m, path: string) => {
      try {
        const u = new URL(path, origin)
        const inner = u.searchParams.get('url')
        if (inner) return `src="${decodeURIComponent(inner)}"`
      } catch {
        /* keep */
      }
      return `src="${path}"`
    }
  )
}

function stripNonPortable(html: string): string {
  let out = html
  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  out = out.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
  out = out.replace(/<!--\s*\$[\s\S]*?-->/g, '')
  out = out.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  // Replace live widget with placeholder so CustomSiteRenderer can remount it.
  out = out.replace(
    /<closet-quote-widget\b[^>]*>[\s\S]*?<\/closet-quote-widget>/gi,
    WIDGET_PLACEHOLDER
  )
  out = out.replace(/<closet-quote-widget\b[^>]*\/?>/gi, WIDGET_PLACEHOLDER)
  return out
}

function extractBodyFragment(html: string): string {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)
  if (main) {
    const nav = html.match(/<nav\b[^>]*>[\s\S]*?<\/nav>/i)
    return `${nav ? nav[0] : ''}\n${main[1]}`
  }
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)
  if (body) return body[1]
  return html
}

async function collectStylesheetCss(html: string, origin: string): Promise<string> {
  const hrefs: string[] = []
  const re = /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    hrefs.push(absUrl(m[1], origin))
  }
  // Also href-before-rel form
  const re2 = /<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*>/gi
  while ((m = re2.exec(html))) {
    hrefs.push(absUrl(m[1], origin))
  }

  const unique = [...new Set(hrefs)].slice(0, 8)
  const chunks: string[] = []
  let total = 0
  const MAX = 180_000
  for (const href of unique) {
    try {
      const res = await fetch(href, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) continue
      let css = await res.text()
      css = css.replace(/@import\b[^;]*;?/gi, '')
      if (total + css.length > MAX) {
        css = css.slice(0, MAX - total)
      }
      chunks.push(`/* from ${href.slice(0, 120)} */\n${css}`)
      total += css.length
      if (total >= MAX) break
    } catch {
      /* skip */
    }
  }
  return chunks.join('\n\n')
}

async function snapshotLivePages(opts: {
  origin: string
  bypassUrl: string
  paths: string[]
}): Promise<{ pages: CustomSiteConfig['pages']; globalCss: string } | null> {
  const pages: CustomSiteConfig['pages'] = {}
  let globalCss = ''
  let anyOk = false

  for (const path of opts.paths) {
    const base = new URL(opts.bypassUrl)
    base.pathname = path === '/' ? '/' : path
    // Keep admin_bypass query
    try {
      const res = await fetch(base.toString(), {
        signal: AbortSignal.timeout(12000),
        headers: { Accept: 'text/html' },
        redirect: 'follow',
      })
      if (!res.ok) continue
      let html = await res.text()
      if (!globalCss) {
        globalCss = await collectStylesheetCss(html, opts.origin)
      }
      html = extractBodyFragment(html)
      html = rewriteNextImageUrls(html, opts.origin)
      html = stripNonPortable(html)
      // Drop Next data / RSC noise attributes commonly left in markup
      html = html.replace(/\s+data-react[^ =]*="[^"]*"/gi, '')
      html = html.replace(/\s+data-n-[\w-]+=("[^"]*"|'[^']*')/gi, '')
      if (html.replace(/\s+/g, '').length < 40) continue
      pages[path] = {
        html,
        title: path === '/' ? 'Home' : path.replace(/^\//, ''),
      }
      anyOk = true
    } catch {
      /* try next path */
    }
  }

  if (!anyOk) return null
  if (!pages['/']) {
    const first = Object.keys(pages)[0]
    if (first) pages['/'] = pages[first]
  }
  return { pages, globalCss }
}

type EngineRow = {
  brand_name?: string | null
  theme?: string | null
  hero_config?: {
    headline?: string
    subheadline?: string
    backgroundImage?: string
  } | null
  about_config?: { description?: string; title?: string } | null
  products_config?: Array<{
    title?: string
    description?: string
    image?: string
  }> | null
  process_config?: {
    title?: string
    subtitle?: string
    steps?: Array<{ number?: string; title?: string; description?: string }>
  } | null
  before_after_config?: {
    beforeImage?: string
    afterImage?: string
    title?: string
    subtitle?: string
  } | null
  nav_links?: Array<{ label?: string; slug?: string }> | null
  pages_config?: Array<{
    slug?: string
    title?: string
    is_active?: boolean
    hero?: { headline?: string }
    content_blocks?: Array<{
      type?: string
      heading?: string
      body?: string
      items?: Array<{ title?: string; body?: string }>
    }>
  }> | null
  seo_config?: {
    phone?: string
    email?: string
    addressLocality?: string
    addressRegion?: string
  } | null
  logo_url?: string | null
}

function baselineGlobalCss(): string {
  return `
:root{--bg:#0f1115;--fg:#f4f1ea;--muted:rgba(244,241,234,.72);--accent:#c4a574;--card:#1a1d24;--line:rgba(255,255,255,.1);}
*{box-sizing:border-box}
body{margin:0;font-family:Georgia,"Times New Roman",serif;background:var(--bg);color:var(--fg);line-height:1.55}
a{color:inherit;text-decoration:none}
img{max-width:100%;height:auto;display:block}
.cs-nav{display:flex;flex-wrap:wrap;gap:1rem 1.5rem;align-items:center;justify-content:space-between;padding:1.25rem 1.5rem;border-bottom:1px solid var(--line);position:sticky;top:0;background:rgba(15,17,21,.92);backdrop-filter:blur(8px);z-index:20}
.cs-nav a{font-size:.9rem;letter-spacing:.04em;opacity:.85}
.cs-nav a:hover{opacity:1}
.cs-brand{font-size:1.15rem;font-weight:600;letter-spacing:.02em}
.cs-hero{min-height:70vh;display:flex;align-items:flex-end;padding:4rem 1.5rem 3.5rem;background:#111 center/cover no-repeat;position:relative}
.cs-hero::before{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.25),rgba(0,0,0,.72))}
.cs-hero-inner{position:relative;z-index:1;max-width:720px}
.cs-hero h1{margin:0;font-size:clamp(2.2rem,6vw,3.75rem);line-height:1.05;letter-spacing:-.02em}
.cs-hero p{margin:1rem 0 0;font-size:1.15rem;color:var(--muted);max-width:36rem}
.cs-section{padding:3.5rem 1.5rem;max-width:1100px;margin:0 auto}
.cs-section h2{margin:0 0 1rem;font-size:clamp(1.6rem,3vw,2.2rem)}
.cs-muted{color:var(--muted)}
.cs-grid{display:grid;gap:1.5rem;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));margin-top:1.75rem}
.cs-card{background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.cs-card .body{padding:1.15rem 1.25rem 1.4rem}
.cs-card h3{margin:0 0 .5rem;font-size:1.15rem}
.cs-steps{display:grid;gap:1.25rem;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin-top:1.5rem}
.cs-step{padding:1.25rem;border:1px solid var(--line);border-radius:12px;background:var(--card)}
.cs-step .num{font-size:.75rem;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-bottom:.5rem}
.cs-ba{display:grid;gap:1rem;grid-template-columns:1fr 1fr}
@media(max-width:700px){.cs-ba{grid-template-columns:1fr}}
.cs-footer{padding:2.5rem 1.5rem 4rem;border-top:1px solid var(--line);color:var(--muted);font-size:.95rem}
.closet-widget-slot{padding:1.5rem 1rem 2.5rem;margin:0 auto;background:transparent;border:none;box-shadow:none;max-width:none;display:flex;justify-content:center}
`.trim()
}

function buildNavHtml(
  brand: string,
  logoUrl: string | null | undefined,
  navLinks: Array<{ label?: string; slug?: string }>
): string {
  const links = navLinks
    .filter((l) => l.label && l.slug)
    .map((l) => `<a href="${esc(l.slug!)}">${esc(l.label!)}</a>`)
    .join('')
  const brandEl = logoUrl
    ? `<a class="cs-brand" href="/"><img src="${esc(logoUrl)}" alt="${esc(brand)}" style="height:40px;width:auto;object-fit:contain" /></a>`
    : `<a class="cs-brand" href="/">${esc(brand)}</a>`
  return `<nav class="cs-nav">${brandEl}<div style="display:flex;flex-wrap:wrap;gap:1rem 1.25rem">${links}</div></nav>`
}

function buildHomeFromConfig(cfg: EngineRow, brand: string): string {
  const hero = cfg.hero_config || {}
  const headline = hero.headline || brand
  const sub = hero.subheadline || ''
  const bg =
    typeof hero.backgroundImage === 'string' &&
    !/\.(mp4|webm|mov)(\?|$)/i.test(hero.backgroundImage)
      ? hero.backgroundImage
      : ''
  const nav = Array.isArray(cfg.nav_links) ? cfg.nav_links : []
  const about = cfg.about_config?.description || ''
  const products = Array.isArray(cfg.products_config) ? cfg.products_config : []
  const process = cfg.process_config
  const ba = cfg.before_after_config
  const seo = cfg.seo_config || {}

  const productCards = products
    .map((p) => {
      const img = p.image
        ? `<img src="${esc(p.image)}" alt="${esc(p.title || '')}" style="width:100%;aspect-ratio:16/10;object-fit:cover" />`
        : ''
      return `<article class="cs-card">${img}<div class="body"><h3>${esc(p.title || 'Service')}</h3><p class="cs-muted">${esc(p.description || '')}</p></div></article>`
    })
    .join('')

  const steps = Array.isArray(process?.steps)
    ? process!.steps!
        .map(
          (s) =>
            `<div class="cs-step"><div class="num">${esc(s.number || '')}</div><h3 style="margin:0 0 .4rem;font-size:1.05rem">${esc(s.title || '')}</h3><p class="cs-muted" style="margin:0">${esc(s.description || '')}</p></div>`
        )
        .join('')
    : ''

  const baHtml =
    ba?.beforeImage && ba?.afterImage
      ? `<section class="cs-section" id="before-after">
  <h2>${esc(ba.title || 'Before & After')}</h2>
  ${ba.subtitle ? `<p class="cs-muted">${esc(ba.subtitle)}</p>` : ''}
  <div class="cs-ba" style="margin-top:1.5rem">
    <figure><img src="${esc(ba.beforeImage)}" alt="Before" /><figcaption class="cs-muted" style="margin-top:.5rem">Before</figcaption></figure>
    <figure><img src="${esc(ba.afterImage)}" alt="After" /><figcaption class="cs-muted" style="margin-top:.5rem">After</figcaption></figure>
  </div>
</section>`
      : ''

  return `
${buildNavHtml(brand, cfg.logo_url, nav)}
<section class="cs-hero" style="${bg ? `background-image:url('${esc(bg)}')` : ''}">
  <div class="cs-hero-inner">
    <h1>${esc(headline)}</h1>
    ${sub ? `<p>${esc(sub)}</p>` : ''}
  </div>
</section>
${
  about
    ? `<section class="cs-section" id="about"><h2>${esc(cfg.about_config?.title || 'About')}</h2><p class="cs-muted" style="font-size:1.1rem;max-width:40rem">${esc(about)}</p></section>`
    : ''
}
${
  productCards
    ? `<section class="cs-section" id="services"><h2>Services</h2><div class="cs-grid">${productCards}</div></section>`
    : ''
}
${
  steps
    ? `<section class="cs-section" id="process"><h2>${esc(process?.title || 'How it works')}</h2>${process?.subtitle ? `<p class="cs-muted">${esc(process.subtitle)}</p>` : ''}<div class="cs-steps">${steps}</div></section>`
    : ''
}
${baHtml}
<section class="closet-widget-slot" id="quote">${WIDGET_PLACEHOLDER}</section>
<footer class="cs-footer">
  <strong style="color:var(--fg)">${esc(brand)}</strong>
  ${seo.phone ? `<div>${esc(String(seo.phone))}</div>` : ''}
  ${seo.email ? `<div>${esc(String(seo.email))}</div>` : ''}
  ${seo.addressLocality ? `<div>${esc([seo.addressLocality, seo.addressRegion].filter(Boolean).join(', '))}</div>` : ''}
</footer>
`.trim()
}

function buildInnerPageFromConfig(
  brand: string,
  page: NonNullable<EngineRow['pages_config']>[number],
  nav: Array<{ label?: string; slug?: string }>,
  logoUrl?: string | null
): string {
  const blocks = Array.isArray(page.content_blocks) ? page.content_blocks : []
  const blocksHtml = blocks
    .map((b) => {
      const items = Array.isArray(b.items)
        ? `<ul>${b.items.map((it) => `<li><strong>${esc(it.title || '')}</strong> ${esc(it.body || '')}</li>`).join('')}</ul>`
        : ''
      return `<section class="cs-section"><h2>${esc(b.heading || '')}</h2><p class="cs-muted">${esc(b.body || '')}</p>${items}</section>`
    })
    .join('\n')

  return `
${buildNavHtml(brand, logoUrl, nav)}
<section class="cs-hero" style="min-height:36vh">
  <div class="cs-hero-inner">
    <h1>${esc(page.hero?.headline || page.title || brand)}</h1>
  </div>
</section>
${blocksHtml || `<section class="cs-section"><p class="cs-muted">${esc(page.title || '')}</p></section>`}
<footer class="cs-footer"><strong style="color:var(--fg)">${esc(brand)}</strong></footer>
`.trim()
}

function buildFromEngineConfig(cfg: EngineRow, brand: string): CustomSiteConfig {
  const nav = Array.isArray(cfg.nav_links) ? cfg.nav_links : []
  const pages: CustomSiteConfig['pages'] = {
    '/': {
      html: buildHomeFromConfig(cfg, brand),
      title: brand,
      description: cfg.hero_config?.subheadline || undefined,
    },
  }

  const pageRows = Array.isArray(cfg.pages_config) ? cfg.pages_config : []
  for (const p of pageRows.slice(0, 6)) {
    if (!p?.slug || p.is_active === false) continue
    const path = p.slug.startsWith('/') ? p.slug : `/${p.slug}`
    if (path === '/' || path.includes('#')) continue
    pages[path] = {
      html: buildInnerPageFromConfig(brand, p, nav, cfg.logo_url),
      title: p.title || path.slice(1),
    }
  }

  return {
    mode: 'inline',
    globalCss: baselineGlobalCss(),
    pages,
  }
}

/**
 * Clone the tenant's *current* live appearance into custom_config_draft:
 * 1) published custom HTML if already live in custom mode
 * 2) else live HTML crawl when a public preview URL is reachable
 * 3) else a content-faithful baseline built from engine site_configs
 *
 * Does not invent a new AI design.
 */
export async function cloneCurrentSiteToDraft(
  tenantId: string,
  opts?: { mode?: 'inline' | 'iframe' }
): Promise<CloneEngineSiteResult> {
  const supabase = getSupabaseAdmin()
  const { data: tenant, error } = await supabase
    .from('tenants')
    .select(
      `
      id,
      business_name,
      domains ( hostname, source, is_primary, vercel_verified, ssl_status ),
      site_configs (
        render_mode,
        brand_name,
        theme,
        logo_url,
        hero_config,
        about_config,
        products_config,
        process_config,
        before_after_config,
        nav_links,
        pages_config,
        seo_config,
        custom_config,
        custom_config_draft
      )
    `
    )
    .eq('id', tenantId)
    .single()

  if (error || !tenant) throw new Error('Tenant not found')
  const cfg = (
    Array.isArray(tenant.site_configs) ? tenant.site_configs[0] : tenant.site_configs
  ) as (EngineRow & {
    render_mode?: string
    custom_config?: unknown
    custom_config_draft?: unknown
  }) | null
  if (!cfg) throw new Error('Site config not found')

  const brand = (cfg.brand_name || tenant.business_name || 'Business') as string
  const mode = opts?.mode === 'iframe' ? 'iframe' : 'inline'
  const warnings: string[] = []

  // 1) Already on custom — baseline = published custom (exact copy).
  if (
    cfg.render_mode === 'custom' &&
    cfg.custom_config &&
    typeof cfg.custom_config === 'object'
  ) {
    const draft = sanitizeCustomConfig({
      ...(cfg.custom_config as CustomSiteConfig),
      mode: (cfg.custom_config as CustomSiteConfig).mode || mode,
    })
    const { error: upErr } = await supabase
      .from('site_configs')
      .update({
        custom_config_draft: draft,
        custom_updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
    if (upErr) throw new Error(upErr.message)
    const pageKeys = Object.keys(draft.pages || {})
    return {
      draft,
      source: 'published_custom',
      warnings,
      pageKeys,
      reply:
        'Cloned the live custom site into a new draft (exact copy). Surgical edits will start from the current published custom design.',
    }
  }

  // 2) Try live HTML snapshot when the preview host is publicly reachable.
  const domainRows = (tenant.domains || []) as PreviewDomainRow[]
  const previewHost = pickPreviewHostname(domainRows)
  const bypassUrl = buildTenantPreviewUrlFromDomains(domainRows)
  const canCrawl =
    !!bypassUrl &&
    !!previewHost &&
    !isDevHostname(previewHost) &&
    !bypassUrl.includes('localhost')

  const pagePaths = ['/']
  for (const p of Array.isArray(cfg.pages_config) ? cfg.pages_config : []) {
    if (!p?.slug || p.is_active === false) continue
    const path = p.slug.startsWith('/') ? p.slug : `/${p.slug}`
    if (path === '/' || path.includes('#')) continue
    if (!pagePaths.includes(path)) pagePaths.push(path)
    if (pagePaths.length >= 5) break
  }

  if (canCrawl && bypassUrl && previewHost) {
    const origin = `https://${previewHost}`
    const snap = await snapshotLivePages({
      origin,
      bypassUrl,
      paths: pagePaths,
    })
    if (snap) {
      const draft = sanitizeCustomConfig({
        mode,
        globalCss: snap.globalCss || baselineGlobalCss(),
        pages: snap.pages,
      })
      // Ensure widget placeholder on home
      const home = draft.pages['/']
      if (home && !home.html.includes(WIDGET_PLACEHOLDER) && !/<closet-quote-widget\b/i.test(home.html)) {
        home.html += `\n<section class="closet-widget-slot">${WIDGET_PLACEHOLDER}</section>`
        draft.pages['/'] = home
      }
      if (!snap.globalCss) {
        warnings.push(
          'Live HTML was cloned but stylesheets could not be fully inlined — layout may need a surgical CSS tweak.'
        )
      }
      const { error: upErr } = await supabase
        .from('site_configs')
        .update({
          custom_config_draft: draft,
          custom_updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenantId)
      if (upErr) throw new Error(upErr.message)
      return {
        draft,
        source: 'live_html',
        warnings,
        pageKeys: Object.keys(draft.pages || {}),
        reply:
          'Cloned the live engine site HTML/CSS into the custom draft. Surgical edits will start from the current site appearance — not a new AI design.',
      }
    }
    warnings.push('Live HTML crawl failed — fell back to a content baseline from the site config.')
  } else if (previewHost && isDevHostname(previewHost)) {
    warnings.push(
      'This tenant only has a *.localhost preview host (not crawlable from the cloud). Built a content-faithful baseline from the current engine config instead.'
    )
  }

  // 3) Config baseline — same copy/images/structure as the engine site.
  const draft = sanitizeCustomConfig({
    ...buildFromEngineConfig(cfg, brand),
    mode,
  })
  const { error: upErr } = await supabase
    .from('site_configs')
    .update({
      custom_config_draft: draft,
      custom_updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
  if (upErr) throw new Error(upErr.message)

  return {
    draft,
    source: 'engine_config',
    warnings,
    pageKeys: Object.keys(draft.pages || {}),
    reply:
      'Created a Custom Build draft that copies this tenant’s current engine site content (hero, about, services, pages, nav, images). Use Edit surgically for changes — use Full redesign only if you want an entirely new AI design.',
  }
}
