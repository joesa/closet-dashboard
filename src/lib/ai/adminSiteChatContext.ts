/**
 * Build the full per-site context pack for the AI Site Assistant.
 * Editable columns are included in full; read-only meta + inventory help the
 * model target the right fields without inventing missing site state.
 */

export type SiteContextPack = {
  identity: Record<string, unknown>
  inventory: Record<string, unknown>
  /** Columns the model may edit — full current values. */
  editableConfig: Record<string, unknown>
  /** Prior assistant apply results still in the durable history window. */
  recentEdits: Array<{ at?: string; applied?: string[]; rejected?: Array<{ column: string; reason: string }> }>
}

function titlesFromProducts(products: unknown): string[] {
  if (!Array.isArray(products)) return []
  return products
    .map((p) => (p && typeof p === 'object' && typeof (p as any).title === 'string' ? (p as any).title : ''))
    .filter(Boolean)
}

function slugsFromPages(pages: unknown): Array<{ slug: string; title: string; is_active?: boolean }> {
  if (!Array.isArray(pages)) return []
  return pages
    .filter((p) => p && typeof p === 'object' && typeof (p as any).slug === 'string')
    .map((p) => ({
      slug: (p as any).slug as string,
      title: typeof (p as any).title === 'string' ? (p as any).title : (p as any).slug,
      is_active: (p as any).is_active !== false,
    }))
}

export function buildSiteContextPack(opts: {
  businessName: string
  hostnames: string[]
  config: Record<string, unknown>
  editableColumns: string[]
  recentEdits?: SiteContextPack['recentEdits']
}): SiteContextPack {
  const { businessName, hostnames, config, editableColumns } = opts
  const editableConfig: Record<string, unknown> = {}
  for (const col of editableColumns) {
    if (col in config) editableConfig[col] = config[col]
  }

  const products = titlesFromProducts(config.products_config)
  const pages = slugsFromPages(config.pages_config)
  const nav = Array.isArray(config.nav_links)
    ? (config.nav_links as Array<{ label?: string; slug?: string }>)
        .filter((l) => typeof l?.slug === 'string')
        .map((l) => ({ label: l.label || l.slug, slug: l.slug }))
    : []

  const hasCustomLive =
    config.render_mode === 'custom' ||
    !!(config.custom_config && typeof config.custom_config === 'object')
  const hasCustomDraft = !!(
    config.custom_config_draft && typeof config.custom_config_draft === 'object'
  )

  return {
    identity: {
      businessName,
      brandName: config.brand_name || businessName,
      hostnames,
      primaryUrl: hostnames[0] ? `https://${hostnames[0]}` : null,
      renderMode: config.render_mode || 'engine',
      hasCustomLive,
      hasCustomDraft,
      logoUrl: typeof config.logo_url === 'string' ? config.logo_url : null,
      pricingNotes: typeof config.pricing_notes === 'string' ? config.pricing_notes : null,
      themeTokensPresent: !!config.theme_tokens,
      engagementModel: config.engagement_model || 'quote',
      theme: config.theme,
      layoutStyle: config.layout_style,
      designVariant: config.design_variant || '',
    },
    inventory: {
      productCount: products.length,
      productTitles: products,
      pageCount: pages.length,
      pages,
      nav,
      // Reminder: /services cards render from products_config (teaser + drawer),
      // not from pages_config grid body text.
      servicesPageNote:
        'The /services page paints clickable cards from products_config (short description on the card; details.longDescription + specifications in the drawer). Do not dump full long copy into pages_config grid items.',
    },
    editableConfig,
    recentEdits: opts.recentEdits || [],
  }
}
