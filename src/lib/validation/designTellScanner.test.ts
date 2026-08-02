import { describe, expect, it } from 'vitest'
import {
  GLOBAL_CSS_UNIT_ID,
  describeDesignTellsForPrompt,
  extractFontFamilies,
  extractRootColorTokens,
  hexToHsl,
  scanArtifactTells,
  scanDesignTells,
  scanUnitTells,
  toUnitQualityReport,
  type ArtifactTellCode,
} from './designTellScanner'

/** A globalCss with a real token set, so token-count checks stay quiet. */
const CLEAN_CSS = `:root{--bg:#eef2f1;--ink:#1a1f1e;--muted:#5a6562;--line:#c5d0cc;--acc:#2f5d50;--df:"Fraunces";--bf:"Karla"}
body{font-family:var(--bf);background:var(--bg);color:var(--ink)}`

const FONTS_LINK =
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces&family=Karla&display=swap">'

/** Copy that clears the specificity gate, so copy codes don't leak into design tests. */
const CONCRETE_COPY = `We hang 3/4 inch birch ply carcasses on Blum hinges, and a typical
walk-in takes 6–8 weeks from template to install. We work across Green Hills and
Belle Meade. We cannot do melamine repairs, and we will say so on the call.`

function homeOnly(html: string, css = CLEAN_CSS) {
  return { globalCss: css, pages: { '/': { html: `${FONTS_LINK}${html}` } } }
}

function codes(findings: Array<{ code: ArtifactTellCode }>): ArtifactTellCode[] {
  return findings.map((f) => f.code)
}

describe('colour helpers', () => {
  it('converts hex to hsl, tolerating shorthand and alpha', () => {
    expect(hexToHsl('#fff')).toEqual({ h: 0, s: 0, l: 1, c: 0 })
    expect(hexToHsl('#000000')).toEqual({ h: 0, s: 0, l: 0, c: 0 })
    // Cream reads as heavily saturated in HSL but is near-colourless by chroma.
    expect(hexToHsl('#f7f4ef')!.s).toBeGreaterThan(0.25)
    expect(hexToHsl('#f7f4ef')!.c).toBeLessThan(0.1)
    const red = hexToHsl('#ff0000')
    expect(red?.h).toBeCloseTo(0)
    expect(red?.s).toBeCloseTo(1)
    expect(hexToHsl('#2f5d50ff')?.h).toBeCloseTo(hexToHsl('#2f5d50')!.h)
    expect(hexToHsl('not-a-hex')).toBeNull()
  })

  it('extracts :root colour tokens in source order', () => {
    expect(extractRootColorTokens(CLEAN_CSS)).toEqual([
      { name: 'bg', hex: '#eef2f1' },
      { name: 'ink', hex: '#1a1f1e' },
      { name: 'muted', hex: '#5a6562' },
      { name: 'line', hex: '#c5d0cc' },
      { name: 'acc', hex: '#2f5d50' },
    ])
  })

  it('reads font families from tokens and the Google Fonts link', () => {
    const fonts = extractFontFamilies(CLEAN_CSS, FONTS_LINK)
    expect(fonts.all).toContain('Fraunces')
    expect(fonts.all).toContain('Karla')
  })
})

describe('design_no_design_tokens', () => {
  it('fires when globalCss has almost no custom properties', () => {
    const found = scanDesignTells({
      globalCss: 'body{background:#fff;color:#111}',
      pages: {},
    })
    expect(codes(found)).toContain('design_no_design_tokens')
  })

  it('accepts a minimal surface/ink/accent system as a real system', () => {
    const found = scanDesignTells({
      globalCss: ':root{--bg:#f7f4ef;--surface:#fff;--acc:#1a5f4a}',
      pages: {},
    })
    expect(codes(found)).not.toContain('design_no_design_tokens')
  })

  it('stays quiet on a real token set', () => {
    expect(codes(scanDesignTells({ globalCss: CLEAN_CSS, pages: {} }))).not.toContain(
      'design_no_design_tokens'
    )
  })
})

describe('design_saas_gradient_hue', () => {
  const css = `${CLEAN_CSS}\n.hero{background:linear-gradient(135deg,#6366f1,#8b5cf6)}`

  it('fires on an indigo/violet gradient', () => {
    expect(codes(scanDesignTells({ globalCss: css, pages: {} }))).toContain(
      'design_saas_gradient_hue'
    )
  })

  it('does not fire on a warm gradient outside the SaaS band', () => {
    const warm = `${CLEAN_CSS}\n.hero{background:linear-gradient(135deg,#96482f,#b45309)}`
    expect(codes(scanDesignTells({ globalCss: warm, pages: {} }))).not.toContain(
      'design_saas_gradient_hue'
    )
  })

  it('stands down when the brief asks for a gradient', () => {
    const found = scanDesignTells({
      globalCss: css,
      pages: {},
      briefText: 'Use a violet gradient in the hero, like the client logo.',
    })
    expect(codes(found)).not.toContain('design_saas_gradient_hue')
  })
})

describe('design_gradient_instead_of_palette', () => {
  it('fires when gradients outnumber the palette', () => {
    const css = `.a{background:linear-gradient(#111,#222)}.b{background:radial-gradient(#333,#444)}.c{background:conic-gradient(#555,#666)}`
    expect(codes(scanDesignTells({ globalCss: css, pages: {} }))).toContain(
      'design_gradient_instead_of_palette'
    )
  })

  it('does not fire when a real palette exists alongside gradients', () => {
    const css = `${CLEAN_CSS}\n.a{background:linear-gradient(#111,#222)}.b{background:radial-gradient(#333,#444)}.c{background:conic-gradient(#555,#666)}`
    expect(codes(scanDesignTells({ globalCss: css, pages: {} }))).not.toContain(
      'design_gradient_instead_of_palette'
    )
  })
})

describe('design_glassmorphism', () => {
  it('fires on backdrop blur over a translucent fill', () => {
    const css = `${CLEAN_CSS}\n.card{backdrop-filter:blur(12px);background:rgba(255,255,255,0.6)}`
    expect(codes(scanDesignTells({ globalCss: css, pages: {} }))).toContain(
      'design_glassmorphism'
    )
  })

  it('does not fire on blur without translucency', () => {
    const css = `${CLEAN_CSS}\n.card{backdrop-filter:blur(12px);background:#ffffff}`
    expect(codes(scanDesignTells({ globalCss: css, pages: {} }))).not.toContain(
      'design_glassmorphism'
    )
  })

  it('stands down when the brief asks for frosted glass', () => {
    const css = `${CLEAN_CSS}\n.card{backdrop-filter:blur(12px);background:rgba(255,255,255,0.6)}`
    const found = scanDesignTells({
      globalCss: css,
      pages: {},
      briefText: 'The shopfront is frosted glass — echo that in the cards.',
    })
    expect(codes(found)).not.toContain('design_glassmorphism')
  })
})

describe('design_floating_orbs', () => {
  it('fires on a round, blurred, absolutely-positioned shape', () => {
    const css = `${CLEAN_CSS}\n.orb{position:absolute;border-radius:50%;filter:blur(80px);background:#2f5d50}`
    expect(codes(scanDesignTells({ globalCss: css, pages: {} }))).toContain(
      'design_floating_orbs'
    )
  })

  it('does not fire on a plain round avatar', () => {
    const css = `${CLEAN_CSS}\n.avatar{border-radius:50%;width:48px}`
    expect(codes(scanDesignTells({ globalCss: css, pages: {} }))).not.toContain(
      'design_floating_orbs'
    )
  })
})

describe('design_dot_grid_texture', () => {
  it('fires on a repeating dot grid', () => {
    const css = `${CLEAN_CSS}\n.bg{background-image:radial-gradient(circle,#c5d0cc 1px,transparent 1px);background-size:24px 24px}`
    expect(codes(scanDesignTells({ globalCss: css, pages: {} }))).toContain(
      'design_dot_grid_texture'
    )
  })

  it('stands down when the brief asks for it', () => {
    const css = `${CLEAN_CSS}\n.bg{background-image:radial-gradient(circle,#c5d0cc 1px,transparent 1px);background-size:24px 24px}`
    const found = scanDesignTells({
      globalCss: css,
      pages: {},
      briefText: 'Use a dot-grid like their pegboard wall.',
    })
    expect(codes(found)).not.toContain('design_dot_grid_texture')
  })
})

describe('design_dark_neon_skin', () => {
  it('fires on near-black plus an acid accent', () => {
    const css = `:root{--bg:#0b0d0f;--ink:#f4f4f4;--muted:#8a8a8a;--line:#222;--acc:#c8f23c}`
    expect(codes(scanDesignTells({ globalCss: css, pages: {} }))).toContain(
      'design_dark_neon_skin'
    )
  })

  it('does not fire on a dark surface with a muted accent', () => {
    const css = `:root{--bg:#0b0d0f;--ink:#f4f4f4;--muted:#8a8a8a;--line:#222;--acc:#35506b}`
    expect(codes(scanDesignTells({ globalCss: css, pages: {} }))).not.toContain(
      'design_dark_neon_skin'
    )
  })

  it('stands down when the brief asks for dark and neon', () => {
    const css = `:root{--bg:#0b0d0f;--ink:#f4f4f4;--muted:#8a8a8a;--line:#222;--acc:#c8f23c}`
    const found = scanDesignTells({
      globalCss: css,
      pages: {},
      briefText: 'Go dark mode with a neon lime accent — matches their bay lighting.',
    })
    expect(codes(found)).not.toContain('design_dark_neon_skin')
  })
})

describe('design_cream_terracotta_skin', () => {
  it('fires on cream paper, terracotta accent and a serif display', () => {
    const css = `:root{--bg:#f7f4ef;--ink:#1a1a1a;--muted:#6b6b6b;--line:#e2ddd4;--acc:#c05a1e}
h1{font-family:Georgia,serif}`
    expect(codes(scanDesignTells({ globalCss: css, pages: {} }))).toContain(
      'design_cream_terracotta_skin'
    )
  })

  it('does not fire without the serif half of the cliché', () => {
    const css = `:root{--bg:#f7f4ef;--ink:#1a1a1a;--muted:#6b6b6b;--line:#e2ddd4;--acc:#c05a1e}`
    expect(codes(scanDesignTells({ globalCss: css, pages: {} }))).not.toContain(
      'design_cream_terracotta_skin'
    )
  })

  it('counts a serif named only in the Google Fonts link', () => {
    const css = `:root{--bg:#f7f4ef;--ink:#1a1a1a;--muted:#6b6b6b;--line:#e2ddd4;--acc:#c05a1e}`
    const found = scanDesignTells({
      globalCss: css,
      pages: {
        '/': {
          html: '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Libre+Baskerville&display=swap"><section></section>',
        },
      },
    })
    expect(codes(found)).toContain('design_cream_terracotta_skin')
  })
})

describe('design_banned_font_family', () => {
  it('fires on Inter as the body face', () => {
    const css = `:root{--bg:#eef2f1;--ink:#111;--muted:#555;--line:#ccc;--acc:#2f5d50;--bf:Inter, sans-serif}`
    expect(codes(scanDesignTells({ globalCss: css, pages: {} }))).toContain(
      'design_banned_font_family'
    )
  })

  it('fires on system-ui as the primary face', () => {
    const css = `${CLEAN_CSS}\n.x{font-family:system-ui, sans-serif}`
    expect(codes(scanDesignTells({ globalCss: css, pages: {} }))).toContain(
      'design_banned_font_family'
    )
  })

  it('does not fire on a deliberate pairing', () => {
    expect(codes(scanDesignTells({ globalCss: CLEAN_CSS, pages: {} }))).not.toContain(
      'design_banned_font_family'
    )
  })

  it('stands down when the brief names the font', () => {
    const css = `:root{--bg:#eef2f1;--ink:#111;--muted:#555;--line:#ccc;--acc:#2f5d50;--bf:Inter, sans-serif}`
    const found = scanDesignTells({
      globalCss: css,
      pages: {},
      briefText: 'Their existing brand book specifies Inter — keep it.',
    })
    expect(codes(found)).not.toContain('design_banned_font_family')
  })
})

describe('design_missing_font_link', () => {
  it('fires when no page links Google Fonts', () => {
    const found = scanDesignTells({
      globalCss: CLEAN_CSS,
      pages: { '/': { html: '<section><h1>Hi</h1></section>' } },
    })
    expect(codes(found)).toContain('design_missing_font_link')
  })

  it('does not fire when the link is present', () => {
    expect(codes(scanDesignTells(homeOnly('<section><h1>Hi</h1></section>')))).not.toContain(
      'design_missing_font_link'
    )
  })
})

describe('design_emoji_in_ui', () => {
  it('fires on emoji in visible copy', () => {
    const found = scanDesignTells(homeOnly('<section><h2>🚀 Fast service</h2></section>'))
    expect(codes(found)).toContain('design_emoji_in_ui')
  })

  it('does not fire on plain copy', () => {
    expect(codes(scanDesignTells(homeOnly('<section><h2>Fast service</h2></section>')))).not.toContain(
      'design_emoji_in_ui'
    )
  })
})

describe('design_em_dash_stack', () => {
  it('fires on two em dashes in one text node', () => {
    const found = scanDesignTells(
      homeOnly('<section><p>We build — and we install — every week</p></section>')
    )
    expect(codes(found)).toContain('design_em_dash_stack')
  })

  it('does not fire on a single em dash', () => {
    const found = scanDesignTells(
      homeOnly('<section><p>We build — and we install every week</p></section>')
    )
    expect(codes(found)).not.toContain('design_em_dash_stack')
  })
})

describe('moved codes keep their old shape', () => {
  it('spec_sheet_cta reports the label without the angle brackets', () => {
    const found = scanDesignTells(homeOnly('<section><a href="/x">View Protocol</a></section>'))
    const hit = found.find((f) => f.code === 'spec_sheet_cta')
    expect(hit?.samples).toEqual(['View Protocol'])
    expect(hit?.message).toBe(
      '/: Replace document-style CTA labels with a natural customer action.'
    )
    expect(hit?.meta).toMatchObject({ path: '/' })
  })

  it('decorative_numbered_list needs three markers and reports the count', () => {
    const two = '<section><span>01</span><span>02</span></section>'
    const three = '<section><span>01</span><span>02</span><span>03</span></section>'
    expect(codes(scanDesignTells(homeOnly(two)))).not.toContain('decorative_numbered_list')
    const hit = scanDesignTells(homeOnly(three)).find(
      (f) => f.code === 'decorative_numbered_list'
    )
    expect(hit?.meta).toMatchObject({ path: '/', count: 3 })
    expect(hit?.message).toBe(
      '/: Remove zero-padded numbering from content that is not a real sequence.'
    )
  })
})

describe('design_triplet_icon_cards', () => {
  const vagueCard = (title: string) =>
    `<div class="card"><svg></svg><h3>${title}</h3><p>We deliver outstanding results with great attention and real care for you.</p></div>`

  it('fires on three identical icon cards that say nothing concrete', () => {
    const html = `<section><div class="grid">${vagueCard('Quality')}${vagueCard('Service')}${vagueCard('Value')}</div></section>`
    expect(codes(scanDesignTells(homeOnly(html)))).toContain('design_triplet_icon_cards')
  })

  it('does not fire when the cards carry real detail', () => {
    const card = (t: string) =>
      `<div class="card"><svg></svg><h3>${t}</h3><p>Blum soft-close hinges, 3/4 inch birch ply, installed in Green Hills within 6–8 weeks.</p></div>`
    const html = `<section><div class="grid">${card('A')}${card('B')}${card('C')}</div></section>`
    expect(codes(scanDesignTells(homeOnly(html)))).not.toContain('design_triplet_icon_cards')
  })

  it('is advisory, not blocking', () => {
    const html = `<section><div class="grid">${vagueCard('Quality')}${vagueCard('Service')}${vagueCard('Value')}</div></section>`
    const hit = scanDesignTells(homeOnly(html)).find(
      (f) => f.code === 'design_triplet_icon_cards'
    )
    expect(hit?.severity).toBe('warning')
  })
})

describe('design_hero_two_button_blob', () => {
  const heroHtml = `<section><h1>Build faster. Ship smarter.</h1>
<a class="btn" href="/a">Get started</a><a class="btn btn-ghost" href="/b">Learn more</a>
<div style="border-radius:50%;filter:blur(60px)"></div></section>`

  it('fires on the stock hero', () => {
    expect(codes(scanDesignTells(homeOnly(heroHtml)))).toContain(
      'design_hero_two_button_blob'
    )
  })

  it('does not fire when the headline names something concrete', () => {
    const concrete = heroHtml.replace(
      'Build faster. Ship smarter.',
      'Walk-in closets in Green Hills, installed in 6–8 weeks'
    )
    expect(codes(scanDesignTells(homeOnly(concrete)))).not.toContain(
      'design_hero_two_button_blob'
    )
  })

  it('does not fire with a single CTA', () => {
    const oneCta = heroHtml.replace('<a class="btn btn-ghost" href="/b">Learn more</a>', '')
    expect(codes(scanDesignTells(homeOnly(oneCta)))).not.toContain(
      'design_hero_two_button_blob'
    )
  })
})

describe('design_dual_lane_gateway', () => {
  const lanes = `<section><div><h2>Wraps</h2><a href="/wraps">See wraps</a></div><div><h2>Detailing</h2><a href="/detail">See detailing</a></div></section>`

  it('fires when the brief does not describe two disciplines', () => {
    expect(codes(scanDesignTells(homeOnly(lanes)))).toContain('design_dual_lane_gateway')
  })

  it('stands down when the brief really is dual-lane', () => {
    const found = scanDesignTells({
      ...homeOnly(lanes),
      briefText: 'They run wraps and mechanical repair under one roof and want both lanes.',
    })
    expect(codes(found)).not.toContain('design_dual_lane_gateway')
  })
})

describe('design_thin_home', () => {
  it('fires on a home with too few sections', () => {
    expect(codes(scanDesignTells(homeOnly('<section><h1>Hi</h1></section>')))).toContain(
      'design_thin_home'
    )
  })

  it('does not fire on a full home', () => {
    const html = `<header></header><main>${'<section><p>x</p></section>'.repeat(5)}</main><footer></footer>`
    expect(codes(scanDesignTells(homeOnly(html)))).not.toContain('design_thin_home')
  })
})

describe('scanArtifactTells', () => {
  it('adds copy findings from the specificity gate, attributed to the page', () => {
    const found = scanArtifactTells({
      globalCss: CLEAN_CSS,
      pages: {
        '/': {
          html: `${FONTS_LINK}<section><h1>Elevate your space</h1><p>We deliver world-class results with a commitment to excellence for every single client we serve across the region every day.</p></section>`,
        },
      },
      businessName: 'Acme Closets',
    })
    const hit = found.find((f) => f.code === 'copy_ai_tell_phrase')
    expect(hit?.unitId).toBe('/')
    expect(hit?.samples.map((s) => s.toLowerCase())).toContain('elevate')
  })

  it('reports uniform positivity once, site-wide', () => {
    const positive = `<section><p>${'We build beautiful closets with excellent materials and a great team that always delivers on time for every client in town. '.repeat(3)}</p></section>`
    const found = scanArtifactTells({
      globalCss: CLEAN_CSS,
      pages: { '/': { html: `${FONTS_LINK}${positive}` }, '/about': { html: positive } },
    })
    expect(found.filter((f) => f.code === 'copy_uniform_positivity')).toHaveLength(1)
  })

  it('stays quiet on concrete copy that admits a limit', () => {
    const found = scanArtifactTells({
      globalCss: CLEAN_CSS,
      pages: {
        '/': {
          html: `${FONTS_LINK}<header></header><main>${`<section><p>${CONCRETE_COPY}</p></section>`.repeat(5)}</main><footer></footer>`,
        },
      },
      businessName: 'Acme Closets',
      locality: 'Nashville',
    })
    expect(found).toEqual([])
  })
})

describe('scanUnitTells', () => {
  it('never blames a page for a globalCss-owned problem', () => {
    const found = scanUnitTells(
      '/about',
      { html: '<section><h2>About</h2><p>Short.</p></section>' },
      { globalCss: 'body{background:#fff}' }
    )
    expect(codes(found)).not.toContain('design_no_design_tokens')
    expect(codes(found)).not.toContain('design_missing_font_link')
    expect(codes(found)).not.toContain('design_thin_home')
    expect(codes(found)).not.toContain('copy_uniform_positivity')
  })

  it('still reports page-owned tells', () => {
    const found = scanUnitTells('/about', { html: '<section><h2>🚀 About</h2></section>' }, {})
    expect(codes(found)).toContain('design_emoji_in_ui')
  })
})

describe('report adapters', () => {
  it('toUnitQualityReport fails only on error-severity findings', () => {
    const advisoryOnly = toUnitQualityReport([
      {
        code: 'design_thin_home',
        unitId: '/',
        severity: 'warning',
        message: 'thin',
        fix: 'add',
        samples: [],
      },
    ])
    expect(advisoryOnly.status).toBe('passed')
    expect(advisoryOnly.failedUnitIds).toEqual([])

    const blocking = toUnitQualityReport([
      {
        code: 'design_glassmorphism',
        unitId: GLOBAL_CSS_UNIT_ID,
        severity: 'error',
        message: 'glass',
        fix: 'remove',
        samples: [],
      },
    ])
    expect(blocking.status).toBe('failed')
    expect(blocking.failedUnitIds).toEqual([GLOBAL_CSS_UNIT_ID])
  })

  it('describeDesignTellsForPrompt numbers findings and carries the fix', () => {
    const text = describeDesignTellsForPrompt([
      {
        code: 'design_glassmorphism',
        unitId: GLOBAL_CSS_UNIT_ID,
        severity: 'error',
        message: 'Glassmorphism cards are banned.',
        fix: 'Remove backdrop-filter.',
        samples: ['backdrop-filter:blur(12px)'],
      },
    ])
    expect(text).toContain('1. [globalCss]')
    expect(text).toContain('FIX: Remove backdrop-filter.')
    expect(text).toContain('Offending:')
  })
})
