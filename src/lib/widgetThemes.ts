/**
 * Curated quote-calculator appearance packs (50).
 * Each theme’s surfaces, text, borders, and accent are designed together
 * for contrast — picking a theme sets the whole calculator chrome.
 */

export type WidgetThemeTokens = {
  id: string
  name: string
  mode: 'light' | 'dark'
  /** One-line for pickers */
  description: string
  brand: string
  brandText: string
  surfaceBase: string
  surfaceElevated: string
  surfaceHover: string
  surfaceMuted: string
  surfaceBorder: string
  surfaceBorderStrong: string
  textPrimary: string
  textSecondary: string
  textMuted: string
}

export const DEFAULT_WIDGET_THEME_ID = 'alabaster'

function t(
  partial: Omit<
    WidgetThemeTokens,
    | 'surfaceHover'
    | 'surfaceMuted'
    | 'surfaceBorderStrong'
    | 'textSecondary'
    | 'textMuted'
    | 'brandText'
  > &
    Partial<
      Pick<
        WidgetThemeTokens,
        | 'surfaceHover'
        | 'surfaceMuted'
        | 'surfaceBorderStrong'
        | 'textSecondary'
        | 'textMuted'
        | 'brandText'
      >
    >
): WidgetThemeTokens {
  const isDark = partial.mode === 'dark'
  return {
    brandText: partial.brandText || (isDark ? '#0a0a0a' : '#ffffff'),
    surfaceHover: partial.surfaceHover || (isDark ? '#222222' : '#f0eeea'),
    surfaceMuted: partial.surfaceMuted || (isDark ? '#2a2a2a' : '#ebe8e2'),
    surfaceBorderStrong: partial.surfaceBorderStrong || (isDark ? '#555555' : '#b0aaa0'),
    textSecondary: partial.textSecondary || (isDark ? '#a0a0a0' : '#6b6b63'),
    textMuted: partial.textMuted || (isDark ? '#6e6e6e' : '#a8a8a0'),
    ...partial,
  } as WidgetThemeTokens
}

export const WIDGET_THEMES: WidgetThemeTokens[] = [
  // ── Original 20 ──────────────────────────────────────────────────
  t({
    id: 'alabaster',
    name: 'Alabaster',
    mode: 'light',
    description: 'Warm gallery white — original ClosetQuote look',
    brand: '#5a6e5a',
    surfaceBase: '#f8f7f5',
    surfaceElevated: '#ffffff',
    surfaceHover: '#f2f1ed',
    surfaceMuted: '#f3f4f6',
    surfaceBorder: '#d6d3cd',
    surfaceBorderStrong: '#bbb7ae',
    textPrimary: '#2d2d2d',
    textSecondary: '#6b6b63',
    textMuted: '#a8a8a0',
  }),
  t({
    id: 'gallery-white',
    name: 'Gallery White',
    mode: 'light',
    description: 'Cool crisp white with steel accent',
    brand: '#3d5a80',
    surfaceBase: '#f4f6f8',
    surfaceElevated: '#ffffff',
    surfaceBorder: '#d0d7de',
    textPrimary: '#1f2933',
  }),
  t({
    id: 'linen',
    name: 'Linen',
    mode: 'light',
    description: 'Soft natural linen with clay accent',
    brand: '#9c6b4a',
    surfaceBase: '#f3efe8',
    surfaceElevated: '#faf7f2',
    surfaceBorder: '#d4c8b8',
    textPrimary: '#3a3228',
  }),
  t({
    id: 'parchment',
    name: 'Parchment',
    mode: 'light',
    description: 'Aged paper with ink accent',
    brand: '#4a3f35',
    brandText: '#f5f0e6',
    surfaceBase: '#f0ebe0',
    surfaceElevated: '#f7f3ea',
    surfaceBorder: '#cfc4b0',
    textPrimary: '#2c261f',
  }),
  t({
    id: 'sage-atelier',
    name: 'Sage Atelier',
    mode: 'light',
    description: 'Muted sage surfaces with deeper green accent',
    brand: '#4f6f52',
    surfaceBase: '#eef2ee',
    surfaceElevated: '#f7faf7',
    surfaceBorder: '#c5d0c5',
    textPrimary: '#243028',
  }),
  t({
    id: 'coastal-mist',
    name: 'Coastal Mist',
    mode: 'light',
    description: 'Soft sea-glass with teal accent',
    brand: '#2a6f7a',
    surfaceBase: '#eef5f6',
    surfaceElevated: '#f8fbfc',
    surfaceBorder: '#c0d4d8',
    textPrimary: '#1c3338',
  }),
  t({
    id: 'arctic-frost',
    name: 'Arctic Frost',
    mode: 'light',
    description: 'Icy blue-gray with polar blue accent',
    brand: '#2563a8',
    surfaceBase: '#f0f4f8',
    surfaceElevated: '#ffffff',
    surfaceBorder: '#c5d1de',
    textPrimary: '#1a2332',
  }),
  t({
    id: 'terracotta',
    name: 'Terracotta',
    mode: 'light',
    description: 'Sunbaked clay with warm earth accent',
    brand: '#c45c26',
    surfaceBase: '#faf3ed',
    surfaceElevated: '#fffaf6',
    surfaceBorder: '#dbc4b0',
    textPrimary: '#3d2a1f',
  }),
  t({
    id: 'ivory-brass',
    name: 'Ivory Brass',
    mode: 'light',
    description: 'Luxury ivory with brass accent',
    brand: '#a67c2d',
    brandText: '#1a1408',
    surfaceBase: '#f7f4ec',
    surfaceElevated: '#fffcf5',
    surfaceBorder: '#d4cbb4',
    textPrimary: '#2a2418',
  }),
  t({
    id: 'slate-studio',
    name: 'Slate Studio',
    mode: 'light',
    description: 'Neutral slate workspace',
    brand: '#475569',
    surfaceBase: '#f1f5f9',
    surfaceElevated: '#ffffff',
    surfaceBorder: '#cbd5e1',
    textPrimary: '#0f172a',
  }),
  t({
    id: 'charcoal-stage',
    name: 'Charcoal Stage',
    mode: 'dark',
    description: 'Dark AV stage — pairs with black sites',
    brand: '#d4a574',
    brandText: '#1a1208',
    surfaceBase: '#121212',
    surfaceElevated: '#1c1c1c',
    surfaceBorder: '#333333',
    textPrimary: '#f2f2f2',
  }),
  t({
    id: 'midnight-ink',
    name: 'Midnight Ink',
    mode: 'dark',
    description: 'Deep navy night with ice accent',
    brand: '#6eb6ff',
    brandText: '#0a1628',
    surfaceBase: '#0b1220',
    surfaceElevated: '#121a2b',
    surfaceBorder: '#243049',
    textPrimary: '#e8eef8',
  }),
  t({
    id: 'obsidian',
    name: 'Obsidian',
    mode: 'dark',
    description: 'Near-black with cool silver accent',
    brand: '#c0c8d4',
    brandText: '#0e1014',
    surfaceBase: '#0a0a0b',
    surfaceElevated: '#141416',
    surfaceBorder: '#2c2c32',
    textPrimary: '#f0f0f2',
  }),
  t({
    id: 'graphite',
    name: 'Graphite',
    mode: 'dark',
    description: 'Industrial dark gray with ember accent',
    brand: '#e85d04',
    brandText: '#1a0a00',
    surfaceBase: '#16181c',
    surfaceElevated: '#1e2228',
    surfaceBorder: '#3a414c',
    textPrimary: '#eceff3',
  }),
  t({
    id: 'espresso',
    name: 'Espresso',
    mode: 'dark',
    description: 'Warm dark brown café',
    brand: '#d4a373',
    brandText: '#1a1008',
    surfaceBase: '#1a1410',
    surfaceElevated: '#241c16',
    surfaceBorder: '#3d3228',
    textPrimary: '#f3ebe3',
  }),
  t({
    id: 'forest-night',
    name: 'Forest Night',
    mode: 'dark',
    description: 'Deep woodland with moss accent',
    brand: '#7cb87c',
    brandText: '#0c160c',
    surfaceBase: '#0e1410',
    surfaceElevated: '#161e18',
    surfaceBorder: '#2c3a30',
    textPrimary: '#e6f0e6',
  }),
  t({
    id: 'ocean-dusk',
    name: 'Ocean Dusk',
    mode: 'dark',
    description: 'Deep teal dusk with aqua accent',
    brand: '#3ecfcf',
    brandText: '#042020',
    surfaceBase: '#0a1618',
    surfaceElevated: '#122022',
    surfaceBorder: '#284244',
    textPrimary: '#e4f4f4',
  }),
  t({
    id: 'copper-loft',
    name: 'Copper Loft',
    mode: 'dark',
    description: 'Dark loft with copper accent',
    brand: '#c77b4a',
    brandText: '#1a0e06',
    surfaceBase: '#141210',
    surfaceElevated: '#1e1a16',
    surfaceBorder: '#3e3630',
    textPrimary: '#f2ebe4',
  }),
  t({
    id: 'noir-brass',
    name: 'Noir Brass',
    mode: 'dark',
    description: 'Black-tie dark with brass accent',
    brand: '#c9a227',
    brandText: '#1a1400',
    surfaceBase: '#0d0d0d',
    surfaceElevated: '#171717',
    surfaceBorder: '#333333',
    textPrimary: '#f5f0e0',
  }),
  t({
    id: 'velvet-cinema',
    name: 'Velvet Cinema',
    mode: 'dark',
    description: 'Home-theater dark with warm rose accent',
    brand: '#e07a7a',
    brandText: '#1a0808',
    surfaceBase: '#100e12',
    surfaceElevated: '#1a161c',
    surfaceBorder: '#3a343f',
    textPrimary: '#f4eef2',
  }),

  // ── +30 new packs ────────────────────────────────────────────────
  t({
    id: 'cloud-linen',
    name: 'Cloud Linen',
    mode: 'light',
    description: 'Airy soft gray with sky accent',
    brand: '#5b8def',
    surfaceBase: '#f5f7fa',
    surfaceElevated: '#ffffff',
    surfaceBorder: '#d5dbe6',
    textPrimary: '#1e293b',
  }),
  t({
    id: 'honeydew',
    name: 'Honeydew',
    mode: 'light',
    description: 'Fresh pale green with leaf accent',
    brand: '#3d8b5a',
    surfaceBase: '#f3f8f3',
    surfaceElevated: '#fbfffb',
    surfaceBorder: '#c9dbc9',
    textPrimary: '#1f3324',
  }),
  t({
    id: 'blush-studio',
    name: 'Blush Studio',
    mode: 'light',
    description: 'Soft blush with rosewood accent',
    brand: '#b85c6e',
    surfaceBase: '#faf4f5',
    surfaceElevated: '#fff9fa',
    surfaceBorder: '#e5cfd3',
    textPrimary: '#3a2228',
  }),
  t({
    id: 'sandstone',
    name: 'Sandstone',
    mode: 'light',
    description: 'Desert sand with canyon accent',
    brand: '#b07d4a',
    surfaceBase: '#f6f1e8',
    surfaceElevated: '#fdfaf4',
    surfaceBorder: '#dccfb8',
    textPrimary: '#3a2e20',
  }),
  t({
    id: 'porcelain',
    name: 'Porcelain',
    mode: 'light',
    description: 'Cool porcelain with indigo accent',
    brand: '#4338ca',
    surfaceBase: '#f8f8fc',
    surfaceElevated: '#ffffff',
    surfaceBorder: '#d4d4e0',
    textPrimary: '#1e1b2e',
  }),
  t({
    id: 'mint-clinic',
    name: 'Mint Clinic',
    mode: 'light',
    description: 'Clean medical mint with teal accent',
    brand: '#0d9488',
    surfaceBase: '#f0faf8',
    surfaceElevated: '#ffffff',
    surfaceBorder: '#c5e5e0',
    textPrimary: '#134e4a',
  }),
  t({
    id: 'sunrise',
    name: 'Sunrise',
    mode: 'light',
    description: 'Warm peach dawn with coral accent',
    brand: '#e07a45',
    surfaceBase: '#fff6f0',
    surfaceElevated: '#fffaf7',
    surfaceBorder: '#f0d4c4',
    textPrimary: '#3d2418',
  }),
  t({
    id: 'blueprint',
    name: 'Blueprint',
    mode: 'light',
    description: 'Architect white with blueprint blue',
    brand: '#1d4ed8',
    surfaceBase: '#f4f7fc',
    surfaceElevated: '#ffffff',
    surfaceBorder: '#c7d4ea',
    textPrimary: '#0f172a',
  }),
  t({
    id: 'olive-grove',
    name: 'Olive Grove',
    mode: 'light',
    description: 'Mediterranean olive with deep olive accent',
    brand: '#6b7040',
    surfaceBase: '#f4f3ea',
    surfaceElevated: '#fbfaf3',
    surfaceBorder: '#d4d2b8',
    textPrimary: '#2c2e1a',
  }),
  t({
    id: 'lavender-mist',
    name: 'Lavender Mist',
    mode: 'light',
    description: 'Soft lavender with amethyst accent',
    brand: '#7c5cbf',
    surfaceBase: '#f6f3fb',
    surfaceElevated: '#fcfaff',
    surfaceBorder: '#d8ccec',
    textPrimary: '#2a1f3d',
  }),
  t({
    id: 'cement',
    name: 'Cement',
    mode: 'light',
    description: 'Modern concrete with charcoal accent',
    brand: '#374151',
    surfaceBase: '#f3f4f6',
    surfaceElevated: '#ffffff',
    surfaceBorder: '#d1d5db',
    textPrimary: '#111827',
  }),
  t({
    id: 'buttercream',
    name: 'Buttercream',
    mode: 'light',
    description: 'Bakery cream with caramel accent',
    brand: '#c48a3a',
    surfaceBase: '#fff9ef',
    surfaceElevated: '#fffdf8',
    surfaceBorder: '#ead9b8',
    textPrimary: '#3a2a14',
  }),
  t({
    id: 'glacier',
    name: 'Glacier',
    mode: 'light',
    description: 'Cold glacier white with cyan accent',
    brand: '#0891b2',
    surfaceBase: '#f0fafa',
    surfaceElevated: '#ffffff',
    surfaceBorder: '#bfe4ec',
    textPrimary: '#164e63',
  }),
  t({
    id: 'rosewood',
    name: 'Rosewood',
    mode: 'light',
    description: 'Warm woodgrain light with rosewood accent',
    brand: '#8b4518',
    brandText: '#fff8f0',
    surfaceBase: '#f7efe8',
    surfaceElevated: '#fcf7f2',
    surfaceBorder: '#dcc4ae',
    textPrimary: '#3b2415',
  }),
  t({
    id: 'pearl',
    name: 'Pearl',
    mode: 'light',
    description: 'Iridescent pearl with soft gold accent',
    brand: '#b8860b',
    brandText: '#1a1400',
    surfaceBase: '#faf9f6',
    surfaceElevated: '#ffffff',
    surfaceBorder: '#e2ddd0',
    textPrimary: '#2d2a22',
  }),
  t({
    id: 'inkwell',
    name: 'Inkwell',
    mode: 'dark',
    description: 'Writer’s desk dark with fountain-pen blue',
    brand: '#5b9fd4',
    brandText: '#061018',
    surfaceBase: '#12141a',
    surfaceElevated: '#1a1e28',
    surfaceBorder: '#2e3545',
    textPrimary: '#e8ecf4',
  }),
  t({
    id: 'ember-forge',
    name: 'Ember Forge',
    mode: 'dark',
    description: 'Forge black with molten ember accent',
    brand: '#ff6b35',
    brandText: '#1a0800',
    surfaceBase: '#140f0c',
    surfaceElevated: '#1e1712',
    surfaceBorder: '#3a2c22',
    textPrimary: '#f5ebe4',
  }),
  t({
    id: 'deep-wine',
    name: 'Deep Wine',
    mode: 'dark',
    description: 'Wine-cellar dark with burgundy accent',
    brand: '#c45c6a',
    brandText: '#1a080c',
    surfaceBase: '#140e12',
    surfaceElevated: '#1e161a',
    surfaceBorder: '#3a2a30',
    textPrimary: '#f4e8ec',
  }),
  t({
    id: 'aurora',
    name: 'Aurora',
    mode: 'dark',
    description: 'Northern-lights dark with violet accent',
    brand: '#a78bfa',
    brandText: '#12081f',
    surfaceBase: '#0e0c16',
    surfaceElevated: '#161222',
    surfaceBorder: '#2e2840',
    textPrimary: '#eee8f8',
  }),
  t({
    id: 'steelworks',
    name: 'Steelworks',
    mode: 'dark',
    description: 'Industrial steel with cool metal accent',
    brand: '#94a3b8',
    brandText: '#0b1018',
    surfaceBase: '#0f1218',
    surfaceElevated: '#181c24',
    surfaceBorder: '#2e3540',
    textPrimary: '#e8edf4',
  }),
  t({
    id: 'moss-cave',
    name: 'Moss Cave',
    mode: 'dark',
    description: 'Earthy cave dark with moss accent',
    brand: '#86a873',
    brandText: '#0c140a',
    surfaceBase: '#10140e',
    surfaceElevated: '#181e16',
    surfaceBorder: '#2e3828',
    textPrimary: '#e6efe0',
  }),
  t({
    id: 'harbor-night',
    name: 'Harbor Night',
    mode: 'dark',
    description: 'Harbor dark with signal-red accent',
    brand: '#ef4444',
    brandText: '#1a0505',
    surfaceBase: '#0e1216',
    surfaceElevated: '#161c22',
    surfaceBorder: '#2a343e',
    textPrimary: '#e8eef4',
  }),
  t({
    id: 'onyx-lime',
    name: 'Onyx Lime',
    mode: 'dark',
    description: 'Onyx black with neon lime accent',
    brand: '#a3e635',
    brandText: '#0a1400',
    surfaceBase: '#0c0e0a',
    surfaceElevated: '#141814',
    surfaceBorder: '#2a3228',
    textPrimary: '#eef4e4',
  }),
  t({
    id: 'twilight-sand',
    name: 'Twilight Sand',
    mode: 'dark',
    description: 'Dusk dunes with warm sand accent',
    brand: '#e0b87a',
    brandText: '#1a1208',
    surfaceBase: '#16120e',
    surfaceElevated: '#201a14',
    surfaceBorder: '#3a3228',
    textPrimary: '#f2ebe0',
  }),
  t({
    id: 'neon-alley',
    name: 'Neon Alley',
    mode: 'dark',
    description: 'Night alley with magenta neon accent',
    brand: '#e879f9',
    brandText: '#160818',
    surfaceBase: '#100e14',
    surfaceElevated: '#1a1620',
    surfaceBorder: '#322838',
    textPrimary: '#f4e8f8',
  }),
  t({
    id: 'pine-lodge',
    name: 'Pine Lodge',
    mode: 'dark',
    description: 'Cabin night with pine green accent',
    brand: '#5a9e6f',
    brandText: '#06140a',
    surfaceBase: '#101410',
    surfaceElevated: '#181e18',
    surfaceBorder: '#2c362c',
    textPrimary: '#e4eee6',
  }),
  t({
    id: 'cobalt-vault',
    name: 'Cobalt Vault',
    mode: 'dark',
    description: 'Vault dark with cobalt accent',
    brand: '#3b82f6',
    brandText: '#040c1a',
    surfaceBase: '#0a0e18',
    surfaceElevated: '#121828',
    surfaceBorder: '#243048',
    textPrimary: '#e4ecf8',
  }),
  t({
    id: 'smoke',
    name: 'Smoke',
    mode: 'dark',
    description: 'Soft smoke gray with soft white accent',
    brand: '#e5e5e5',
    brandText: '#141414',
    surfaceBase: '#181818',
    surfaceElevated: '#222222',
    surfaceBorder: '#3a3a3a',
    textPrimary: '#f0f0f0',
  }),
  t({
    id: 'amber-den',
    name: 'Amber Den',
    mode: 'dark',
    description: 'Cozy den dark with amber accent',
    brand: '#f59e0b',
    brandText: '#1a1000',
    surfaceBase: '#14110c',
    surfaceElevated: '#1e1a14',
    surfaceBorder: '#3a3224',
    textPrimary: '#f5eedf',
  }),
  t({
    id: 'rift',
    name: 'Rift',
    mode: 'dark',
    description: 'Deep space dark with electric cyan accent',
    brand: '#22d3ee',
    brandText: '#021418',
    surfaceBase: '#080c12',
    surfaceElevated: '#101820',
    surfaceBorder: '#243040',
    textPrimary: '#e0f4f8',
  }),
]

const BY_ID = new Map(WIDGET_THEMES.map((theme) => [theme.id, theme]))

export function isWidgetThemeId(value: unknown): value is string {
  return typeof value === 'string' && BY_ID.has(value)
}

export function resolveWidgetTheme(id: string | null | undefined): WidgetThemeTokens {
  if (id && BY_ID.has(id)) return BY_ID.get(id)!
  return BY_ID.get(DEFAULT_WIDGET_THEME_ID)!
}

/** CSS custom properties applied on the widget root. */
export function widgetThemeToCssVars(theme: WidgetThemeTokens): Record<string, string> {
  return {
    '--brand-color': theme.brand,
    '--brand-text-color': theme.brandText,
    '--color-surface-base': theme.surfaceBase,
    '--color-surface-elevated': theme.surfaceElevated,
    '--color-surface-hover': theme.surfaceHover,
    '--color-surface-muted': theme.surfaceMuted,
    '--color-surface-border': theme.surfaceBorder,
    '--color-surface-border-strong': theme.surfaceBorderStrong,
    '--color-text-primary': theme.textPrimary,
    '--color-text-secondary': theme.textSecondary,
    '--color-text-muted': theme.textMuted,
  }
}

export function listWidgetThemesForAdmin(): Array<{
  id: string
  name: string
  mode: 'light' | 'dark'
  description: string
  brand: string
  surfaceBase: string
  surfaceElevated: string
  textPrimary: string
}> {
  return WIDGET_THEMES.map((theme) => ({
    id: theme.id,
    name: theme.name,
    mode: theme.mode,
    description: theme.description,
    brand: theme.brand,
    surfaceBase: theme.surfaceBase,
    surfaceElevated: theme.surfaceElevated,
    textPrimary: theme.textPrimary,
  }))
}

export const listWidgetThemes = listWidgetThemesForAdmin

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.trim().replace('#', '').match(/^([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!m) return null
  let h = m[1]
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function colorDistance(a: string, b: string): number {
  const ra = hexToRgb(a)
  const rb = hexToRgb(b)
  if (!ra || !rb) return 9999
  const dr = ra[0] - rb[0]
  const dg = ra[1] - rb[1]
  const db = ra[2] - rb[2]
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

/** Infer light vs dark from generated custom HTML/CSS. */
export function inferSiteAppearanceMode(
  html: string,
  css: string
): 'light' | 'dark' {
  // Prefer the design-token --bg when present — cream paper sites often also
  // declare dark section tokens (#131518) that would otherwise tip the vote.
  const bgToken = (css || '').match(/--bg\s*:\s*(#[0-9a-fA-F]{3,8})\b/)
  if (bgToken) {
    const hex = bgToken[1].toLowerCase()
    const expanded =
      hex.length === 4
        ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
        : hex
    const r = parseInt(expanded.slice(1, 3), 16)
    const g = parseInt(expanded.slice(3, 5), 16)
    const b = parseInt(expanded.slice(5, 7), 16)
    if ([r, g, b].every((n) => Number.isFinite(n))) {
      // Relative luminance — light paper vs dark canvas.
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
      return lum >= 0.45 ? 'light' : 'dark'
    }
  }

  const blob = `${css || ''}\n${html || ''}`.toLowerCase()
  const darkHits = (
    blob.match(
      /#0[0-9a-f]{5}|#1[0-9a-f]{5}|background(?:-color)?:\s*#000\b|background(?:-color)?:\s*black\b|color-scheme:\s*dark|--bg[^:;]*:\s*#0/g
    ) || []
  ).length
  const lightHits = (
    blob.match(
      /#f[0-9a-f]{5}|#ffffff|background(?:-color)?:\s*#fff\b|background(?:-color)?:\s*white\b|color-scheme:\s*light/g
    ) || []
  ).length
  if (darkHits === 0 && lightHits === 0) return 'light'
  return darkHits >= lightHits ? 'dark' : 'light'
}

const INDUSTRY_THEME_BOOST: Array<{ re: RegExp; ids: string[] }> = [
  {
    re: /theater|theatre|cinema|audio.?visual|\bav\b|home theater|media room|smart home/i,
    ids: ['velvet-cinema', 'charcoal-stage', 'noir-brass', 'midnight-ink', 'obsidian'],
  },
  {
    re: /restaurant|cafe|coffee|bakery|food|catering|bar\b/i,
    ids: ['espresso', 'buttercream', 'amber-den', 'linen', 'deep-wine'],
  },
  {
    re: /medical|dental|clinic|health|wellness|spa/i,
    ids: ['mint-clinic', 'arctic-frost', 'gallery-white', 'cloud-linen', 'porcelain'],
  },
  {
    re: /landscape|garden|lawn|outdoor|tree|nursery/i,
    ids: ['forest-night', 'sage-atelier', 'honeydew', 'moss-cave', 'olive-grove'],
  },
  {
    re: /plumb|hvac|electric|contractor|construction|roof/i,
    ids: ['slate-studio', 'cement', 'blueprint', 'steelworks', 'graphite'],
  },
  {
    re: /law|attorney|finance|wealth|consult/i,
    ids: ['noir-brass', 'inkwell', 'pearl', 'ivory-brass', 'obsidian'],
  },
  {
    // Include car wash / ceramic / tint so light cream redesigns don't fall
    // through to a random purple pack (e.g. Lavender Mist) off a stale slate hex.
    re: /auto|garage|detail|tow|car\s*wash|ceramic|tint|mobile\s+(auto|detail|wash)/i,
    ids: [
      'terracotta',
      'slate-studio',
      'cement',
      'sandstone',
      'rosewood',
      'graphite',
      'ember-forge',
      'steelworks',
      'harbor-night',
      'smoke',
      'copper-loft',
    ],
  },
]

/**
 * Pick the best matched calculator theme for a site / industry / brand color.
 * Used on provision and Full Redesign so the engagement widget blends in.
 */
export function pickWidgetThemeForSite(opts: {
  mode?: 'light' | 'dark' | null
  brandColor?: string | null
  industryHint?: string | null
  /** Optional preferred ids (e.g. from AI) — first valid wins if mode matches. */
  preferredIds?: string[] | null
}): WidgetThemeTokens {
  const mode = opts.mode === 'dark' || opts.mode === 'light' ? opts.mode : 'light'
  let pool = WIDGET_THEMES.filter((theme) => theme.mode === mode)
  if (pool.length === 0) pool = [...WIDGET_THEMES]

  if (opts.preferredIds?.length) {
    for (const id of opts.preferredIds) {
      const hit = pool.find((theme) => theme.id === id)
      if (hit) return hit
    }
  }

  const scores = new Map<string, number>()
  for (const theme of pool) scores.set(theme.id, 0)

  const hint = (opts.industryHint || '').trim()
  if (hint) {
    for (const rule of INDUSTRY_THEME_BOOST) {
      if (!rule.re.test(hint)) continue
      for (let i = 0; i < rule.ids.length; i++) {
        const id = rule.ids[i]
        if (scores.has(id)) scores.set(id, (scores.get(id) || 0) + (40 - i * 5))
      }
    }
  }

  const brand = opts.brandColor?.trim()
  if (brand && hexToRgb(brand)) {
    for (const theme of pool) {
      const dist = colorDistance(brand, theme.brand)
      // Closer accent → higher score
      scores.set(theme.id, (scores.get(theme.id) || 0) + Math.max(0, 50 - dist / 4))
    }
  }

  let best = pool[0]
  let bestScore = -Infinity
  for (const theme of pool) {
    const s = scores.get(theme.id) || 0
    if (s > bestScore) {
      bestScore = s
      best = theme
    }
  }
  return best
}

/** Persist theme id + matching accent on contractor_settings. */
export async function applyWidgetThemeToContractor(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: { from: (table: string) => any },
  contractorId: string,
  themeId: string
): Promise<WidgetThemeTokens> {
  const theme = resolveWidgetTheme(themeId)
  const { error } = await admin
    .from('contractor_settings')
    .update({
      widget_theme_id: theme.id,
      primary_color_hex: theme.brand,
    })
    .eq('id', contractorId)
  if (error) throw new Error(error.message)
  return theme
}
