import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  applyHeroFitToGlobalCss,
  applyHeroImageToHomeHtml,
  assessFullRedesignCraft,
  extractCssAccent,
  looksLikeHeroImageSurgicalRequest,
  mergeCustomPatch,
  resolveHeroImageFit,
  wantsWholeHeroImageVisible,
} from './generateCustomSite'
import type { CustomSiteConfig } from '@/lib/customSite'

const base: CustomSiteConfig = {
  mode: 'inline',
  globalCss: 'body{color:#111}',
  pages: {
    '/': { html: '<h1>Old Home</h1>', title: 'Home' },
    '/about': { html: '<h1>About</h1>', title: 'About' },
    '/contact': { html: '<h1>Contact</h1>', title: 'Contact' },
  },
}

describe('mergeCustomPatch', () => {
  it('updates only the pages and fields in the patch', () => {
    const { merged, changedPages } = mergeCustomPatch(base, {
      pages: {
        '/': { html: '<h1>New Home</h1>' },
      },
    })
    expect(changedPages).toEqual(['/'])
    expect(merged.pages['/'].html).toBe('<h1>New Home</h1>')
    expect(merged.pages['/about'].html).toBe('<h1>About</h1>')
    expect(merged.pages['/contact'].html).toBe('<h1>Contact</h1>')
    expect(merged.globalCss).toBe('body{color:#111}')
  })

  it('does not drop pages omitted from the patch', () => {
    const { merged } = mergeCustomPatch(base, { pages: { '/about': { title: 'Our Story' } } })
    expect(Object.keys(merged.pages).sort()).toEqual(['/', '/about', '/contact'])
    expect(merged.pages['/about'].title).toBe('Our Story')
    expect(merged.pages['/about'].html).toBe('<h1>About</h1>')
  })

  it('ignores null globalCss (no overwrite)', () => {
    const { merged } = mergeCustomPatch(base, { globalCss: null, pages: {} })
    expect(merged.globalCss).toBe('body{color:#111}')
  })

  it('applies globalCss when provided as a string', () => {
    const { merged } = mergeCustomPatch(base, { globalCss: ':root{--c:red}' })
    expect(merged.globalCss).toBe(':root{--c:red}')
  })

  it('appends additive CSS instead of wiping a design-system sheet', () => {
    const rich: CustomSiteConfig = {
      ...base,
      globalCss:
        ':root{--bg:#fff;--ink:#111;--acc:#c00;--df:sans;--bf:serif}body{color:var(--ink)}',
    }
    const { merged, warnings } = mergeCustomPatch(rich, {
      globalCss: '.clickable-card{cursor:pointer}',
    })
    expect(merged.globalCss).toContain(':root')
    expect(merged.globalCss).toContain('.clickable-card')
    expect(warnings.length).toBeGreaterThan(0)
  })
})

describe('extractCssAccent', () => {
  it('reads --acc from design tokens', () => {
    expect(extractCssAccent(':root{--bg:#f4f1ea;--acc:#c05a1e;--ink:#111}')).toBe(
      '#c05a1e'
    )
  })

  it('reads --accent as a fallback name', () => {
    expect(extractCssAccent('--accent: #a67c2d;')).toBe('#a67c2d')
  })

  it('returns null when no accent token exists', () => {
    expect(extractCssAccent('body{color:#111}')).toBeNull()
  })
})

describe('full redesign additive service policy', () => {
  it('prompts allow brief-added services and forbid silent drops', () => {
    const src = readFileSync(join(__dirname, 'generateCustomSite.ts'), 'utf8')
    expect(src).toContain('REQUIRED SERVICE ADDS')
    expect(src).toContain('serviceUpdates.added')
    expect(src).toContain('Do NOT drop intake services unless the brief explicitly removes')
    expect(src).not.toContain('Do not invent extra services; do not drop any.')
  })
})

describe('full redesign craft uplift prompt', () => {
  const src = readFileSync(join(__dirname, 'generateCustomSite.ts'), 'utf8')

  it('requires a signature concept from subject-derived direction', () => {
    expect(src).toContain('signature concept')
    expect(src).toContain('subject-derived design')
    expect(src).toContain('Pass 1 — Direction')
  })

  it('includes CSS-only cookbook and bans JS form estimators', () => {
    expect(src).toContain('ALLOWED CSS-only interactivity')
    expect(src).toContain('details/summary')
    expect(src).toContain('FORBIDDEN:')
    expect(src).toContain('multi-step quote/booking wizards')
    expect(src).toContain('Map any brief "quote estimator"')
  })

  it('keeps compact size budgets for serverless time limits', () => {
    expect(src).toContain('≤9000 chars')
    expect(src).toContain('≤12000 chars')
    expect(src).toContain('≤7000 chars')
  })
})

describe('assessFullRedesignCraft', () => {
  it('warns on thin home without tokens or fonts', () => {
    const tips = assessFullRedesignCraft({
      config: {
        mode: 'inline',
        globalCss: 'body{color:#111}',
        pages: { '/': { html: '<header></header><h1>Hi</h1>' } },
      },
      serviceCount: 3,
      brief: 'mobile detailing in clarksville',
    })
    expect(tips.some((t) => /thin/i.test(t))).toBe(true)
    expect(tips.some((t) => /CSS variables|token/i.test(t))).toBe(true)
    expect(tips.some((t) => /Google Fonts/i.test(t))).toBe(true)
    // Multiple services alone must NOT imply dual-lane
    expect(tips.some((t) => /dual-lane|second accent/i.test(t))).toBe(false)
  })

  it('only hints dual-lane when the brief is explicitly dual-discipline', () => {
    const tips = assessFullRedesignCraft({
      config: {
        mode: 'inline',
        globalCss: ':root{--bg:#fff;--acc:#111}',
        pages: {
          '/': {
            html: `<link href="https://fonts.googleapis.com/css2?family=Manrope&display=swap" rel="stylesheet">
<section></section><section></section><section></section><section></section>`,
          },
        },
      },
      serviceCount: 6,
      brief: 'vinyl wraps and mechanical brake repair under one roof',
    })
    expect(tips.some((t) => /two distinct lanes|second accent/i.test(t))).toBe(true)
  })

  it('flags dark+neon AI default when brief did not ask for it', () => {
    const tips = assessFullRedesignCraft({
      config: {
        mode: 'inline',
        globalCss: ':root{--ink:#0b0d0f;--acc:#c8f23c}',
        pages: {
          '/': {
            html: `<link href="https://fonts.googleapis.com/css2?family=Manrope&display=swap" rel="stylesheet">
<section></section><section></section><section></section><section></section>`,
          },
        },
      },
      brief: 'friendly family plumbing',
    })
    expect(tips.some((t) => /dark \+ neon|AI default/i.test(t))).toBe(true)
  })

  it('flags cream+terracotta AI default when brief did not ask for it', () => {
    const tips = assessFullRedesignCraft({
      config: {
        mode: 'inline',
        globalCss: ':root{--paper:#f4f1ea;--acc:#c05a1e}',
        pages: {
          '/': {
            html: `<link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville&display=swap" rel="stylesheet">
<section></section><section></section><section></section><section></section>`,
          },
        },
      },
      brief: 'mobile detailing in clarksville',
    })
    expect(tips.some((t) => /cream paper \+ terracotta/i.test(t))).toBe(true)
  })

  it('stays quiet for a token-rich multi-section home', () => {
    const tips = assessFullRedesignCraft({
      config: {
        mode: 'inline',
        globalCss: ':root{--bg:#f7f4ef;--surface:#fff;--acc:#1a5f4a}',
        pages: {
          '/': {
            html: `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope&display=swap">
<section></section><section></section><section></section><section></section>
<a class="btn">Get a quote</a>`,
          },
        },
      },
      serviceCount: 4,
      brief: 'warm coastal cleaning',
    })
    expect(tips).toEqual([])
  })
})

describe('full redesign anti-AI bias', () => {
  it('prompt bans AI default clusters and requires subject-derived design', () => {
    const src = readFileSync(join(__dirname, 'generateCustomSite.ts'), 'utf8')
    expect(src).toContain('subject-derived design')
    expect(src).toContain('Banned defaults')
    expect(src).toContain('Cream/off-white + high-contrast serif')
    expect(src).toContain('NEVER default to dark charcoal + neon')
    expect(src).toContain('ENGAGEMENT ENGINE')
    expect(src).toContain('WIDGET_PLACEHOLDER')
    expect(src).not.toContain('cyan = how it looks / gold = how it runs')
    expect(src).not.toContain('carbon-ish overlay')
    expect(src).not.toContain('Builder prompt')
    expect(src).not.toContain('Next.js + Tailwind')
  })
})

describe('full redesign design guard', () => {
  const src = readFileSync(join(__dirname, 'generateCustomSite.ts'), 'utf8')

  it('wires the avoid list into the prompt and the enhancer', () => {
    expect(src).toContain('loadDesignAvoidList')
    expect(src).toContain('avoidList.promptBlock')
    expect(src).toContain('avoid: opts.avoidList')
    expect(src).toContain('rhythmLock')
  })

  it('guards the foundation, each page, and the finished artifact', () => {
    expect(src).toContain("runGuard(\n      'foundation'")
    expect(src).toContain('scanUnitTells')
    expect(src).toContain('findDesignCollisions')
    expect(src).toContain('recordCustomDesignFingerprint')
  })

  it('uniqueness repair regenerates the full foundation and re-checks uniqueness', () => {
    // The repair must send BOTH globalCss and home HTML back (palette/type
    // live in the CSS) and its scan must recompute collisions + fleet
    // convergence on the assembled candidate, or the retry loop is a no-op.
    expect(src).toContain('const uniquenessScan = (candidate: RepairUnits)')
    expect(src).toContain('[cssUnitId]: draft.globalCss')
    expect(src).toContain('uniquenessFindings(assessUniqueness(candidateCfg))')
    expect(src).toContain('findFleetConvergence')
    expect(src).toContain('findFamilyConvergence')
  })

  it('fails closed when the uniqueness registry is unavailable', () => {
    expect(src).toContain('failClosed: true')
  })

  it('preflights widget identity before a full redesign', () => {
    expect(src).toContain('tenant has no widget_id')
    expect(src).toContain('engagement_model is not set')
  })

  it('checkpoints before every guard so a crash mid-repair stays resumable', () => {
    // remainingFullRedesignPaths treats any page with usable HTML as done, so a
    // guard must never run before the checkpoint that records the raw unit —
    // otherwise a crash during repair loses the page and burns a model call.
    const foundationCheckpoint = src.indexOf("console.info('[runFullGenerate] checkpoint home')")
    const foundationGuard = src.indexOf("runGuard(\n      'foundation'")
    expect(foundationCheckpoint).toBeGreaterThan(0)
    expect(foundationGuard).toBeGreaterThan(foundationCheckpoint)

    const pageCheckpoint = src.indexOf("console.info('[runFullGenerate] checkpoint', path)")
    const pageGuard = src.indexOf('const repairedUnits = await computeGuardRepair(')
    expect(pageCheckpoint).toBeGreaterThan(0)
    expect(pageGuard).toBeGreaterThan(pageCheckpoint)
  })

  it('keeps page fan-out safe: model calls parallel, shared-state writes serialized', () => {
    // The page loop runs concurrently, so every mutation of `draft` and of the
    // job row (report → patchProgress is a read-modify-write) must sit inside
    // the serializer. A bare `draft =` in the page path would lose pages.
    expect(src).toContain('const serializePageWrite = createSerializer()')
    expect(src).toContain('mapWithConcurrency(pageTargets, pageConcurrency')

    const fanOutStart = src.indexOf('const buildOnePage = async')
    const fanOutEnd = src.indexOf('const added = serviceUpdates.added')
    expect(fanOutStart).toBeGreaterThan(0)
    expect(fanOutEnd).toBeGreaterThan(fanOutStart)

    const pageSection = src.slice(fanOutStart, fanOutEnd)
    for (const mutation of pageSection.match(/^\s*draft = .*$/gm) || []) {
      // Every draft mutation in the fan-out region is inside a serialized block.
      const at = pageSection.indexOf(mutation)
      const enclosing = pageSection.lastIndexOf('serializePageWrite(async () => {', at)
      expect(enclosing, `unserialized draft mutation: ${mutation.trim()}`).toBeGreaterThan(-1)
    }
  })

  it('decides uniqueness before the pages are built, not after', () => {
    // The repair rewrites globalCss and home. Running it after the page loop
    // left every other page styled by CSS that had just been replaced, with
    // nothing re-running them — a silent visual break, not just wasted calls.
    const repair = src.indexOf("'[runFullGenerate] uniqueness repair'")
    const chrome = src.indexOf('const chrome = extractChromeSample(')
    const fanOut = src.indexOf('mapWithConcurrency(pageTargets, pageConcurrency')
    expect(repair).toBeGreaterThan(0)
    expect(chrome).toBeGreaterThan(repair)
    expect(fanOut).toBeGreaterThan(repair)
  })

  it('skips the uniqueness repair on a resume so it cannot strand earlier pages', () => {
    expect(src).toContain('const builtHomeThisRun = remaining().includes(\'/\')')
    expect(src).toContain('repairBudgetLeft() && builtHomeThisRun')
  })

  it('re-assesses uniqueness after the pages, for warnings only', () => {
    const fanOut = src.indexOf('mapWithConcurrency(pageTargets, pageConcurrency')
    const reassess = src.lastIndexOf('assessment = assessUniqueness(draft)')
    const collisions = src.indexOf('const collisions = assessment.collisions')
    expect(reassess).toBeGreaterThan(fanOut)
    expect(collisions).toBeGreaterThan(reassess)
    // No repair may follow the fan-out — that is the bug this replaced.
    expect(src.slice(fanOut).includes('repairDesignTells(')).toBe(false)
  })

  it('retries a failed page once in-run instead of discarding its siblings', () => {
    expect(src).toContain("console.warn('[runFullGenerate] page retry', path)")
    expect(src).toContain('completed pages remain checkpointed for Graphile resume')
  })

  it('blocks publish on a duplicated home rhythm', () => {
    expect(src).toContain('design_duplicate_visual')
    expect(src).toContain('Cannot publish:')
  })

  it('publishes the live config and fingerprint in one database transaction', () => {
    expect(src).toContain("'publish_custom_site_with_fingerprint'")
    expect(src).toContain('Failed to publish site and fingerprint atomically')
  })

  it('fails closed when a new worker job cannot reserve a direction', () => {
    expect(src).toContain('Full redesign direction reservation service is unavailable')
    expect(src).toContain('could not reserve a distinct direction after eight attempts')
  })
})

describe('full redesign brief enhancement', () => {
  it('wires enhanceFullRedesignBrief before site generation', () => {
    const src = readFileSync(join(__dirname, 'generateCustomSite.ts'), 'utf8')
    expect(src).toContain('enhanceFullRedesignBrief')
    expect(src).toContain('OPTIMIZED CREATIVE BRIEF')
    expect(src).toContain('ADMIN SEED')
    expect(src).toContain('DIRECTION LOCK')
    expect(src).toContain('SELF-AUTHORED DESIGN DIRECTION PROMPT')
    expect(src).toContain('FULL_REDESIGN_DESIGN_SYSTEM')
    expect(src).toContain('buildInventedRedesignBriefNote')
    expect(src).toContain('useFullRedesignProviderChain: true')
    expect(src).toContain('generateTextFullRedesign')
  })
})

describe('surgical + intake copy model', () => {
  it('uses surgical provider chain with human-voice rules and CSS integrity', () => {
    const src = readFileSync(join(__dirname, 'generateCustomSite.ts'), 'utf8')
    expect(src).toContain('HUMAN_COPY_VOICE_RULES_SURGICAL')
    expect(src).toContain('useSurgicalProviderChain: true')
    expect(src).toContain('assertSurgicalIntegrity')
    expect(src).toContain('globalCssAppend')
    expect(src).toContain('trySurgicalClickableCardsShortcut')
    expect(src).toContain('classifySurgicalIntent')
    expect(src).toContain('runSurgicalOpsGenerate')
  })
})

describe('custom-build attachment policy', () => {
  it('keeps every paperclip attachment reference-only, including explicit placement requests', () => {
    const src = readFileSync(join(__dirname, 'generateCustomSite.ts'), 'utf8')
    expect(src).toContain('REFERENCE-ONLY ATTACHMENTS')
    expect(src).toContain('Even if the admin explicitly asks to place an attachment')
    expect(src).toContain('do not insert, embed, upload, publish, reproduce, or derive a site URL')
    expect(src).not.toContain('context.attachedAssetUrls')
    expect(src).not.toContain('ATTACHED CDN ASSET')
    expect(src).not.toContain('adminWantsAttachmentsOnSite')
    expect(src).not.toContain('placeableAssetUrls')
    expect(src).not.toContain('apply the implied fix')
  })
})

describe('AI Site Assistant attachment policy', () => {
  it('never persists or places chat attachments', () => {
    const src = readFileSync(join(__dirname, 'adminSiteChat.ts'), 'utf8')
    expect(src).toContain('Chat attachments are not site assets')
    expect(src).toContain('NEVER insert, embed, upload, publish, reproduce, or derive')
    expect(src).not.toContain('persistAssistantAttachments')
    expect(src).not.toContain('adminWantsAttachmentsOnSite')
    expect(src).not.toContain('usableAttachments')
    expect(src).not.toContain('uploadedAssets')
  })

  it('keeps Full Redesign paperclips transient instead of uploading to Media & Files', () => {
    const src = readFileSync(
      join(__dirname, '../../components/AdminCustomBuild.tsx'),
      'utf8'
    )
    expect(src).toContain('fileToAdminImageDataUrl(file)')
    expect(src).not.toContain('persistPromptImage')
    expect(src).not.toContain("fd.append('label', file.name || 'prompt-attachment')")
  })
})

describe('surgical hero image helpers', () => {
  const oldUrl =
    'https://example.supabase.co/storage/v1/object/public/site-assets/custom/t/old.jpg'
  const newUrl =
    'https://example.supabase.co/storage/v1/object/public/site-assets/custom/t/new.png'

  it('detects hero + attached image instructions', () => {
    expect(
      looksLikeHeroImageSurgicalRequest(
        'Use this image attached for the Hero image on the main page. Make sure the whole image can be seen'
      )
    ).toBe(true)
    expect(looksLikeHeroImageSurgicalRequest('Fix the typo in the headline')).toBe(false)
    expect(wantsWholeHeroImageVisible('whole image can be seen and not enlarged out of view')).toBe(
      true
    )
  })

  it('prefers cover when asked to fill the hero, even if also asked to show the whole image', () => {
    expect(resolveHeroImageFit('whole image can be seen and not cropped')).toBe('contain')
    expect(
      resolveHeroImageFit(
        'Use this image for the Hero. Make sure the image covers the whole Hero and the whole image can be seen'
      )
    ).toBe('cover')
  })

  it('swaps hero background-image and applies contain fit', () => {
    const html = `<section class="hero" style="background-image:url(${oldUrl})"><div class="wrap"><h1>Hi</h1></div></section>`
    const out = applyHeroImageToHomeHtml(html, newUrl, 'contain')
    expect(out).toContain(newUrl)
    expect(out).not.toContain(oldUrl)
    expect(out).toMatch(/background-size:\s*contain/i)
    expect(out).toMatch(/min-height:/i)
  })

  it('applies cover with min-height so the hero band fills edge-to-edge', () => {
    const html = `<section class="hero" style="background-image:url(${oldUrl})"><div class="wrap"><h1>Hi</h1></div></section>`
    const out = applyHeroImageToHomeHtml(html, newUrl, 'cover')
    expect(out).toMatch(/background-size:\s*cover/i)
    expect(out).toMatch(/min-height:/i)
    expect(out).not.toMatch(/background-size:\s*contain/i)
  })

  it('updates global .hero background-size to match fit', () => {
    const css = '.hero{position:relative;background-size:cover;background-position:center;}'
    expect(applyHeroFitToGlobalCss(css, 'contain')).toContain('background-size:contain')
  })

  it('keeps explicit URL/media hero shortcuts without attachment fallback', () => {
    const src = readFileSync(join(__dirname, 'generateCustomSite.ts'), 'utf8')
    expect(src).toContain('trySurgicalHeroImageShortcut')
    expect(src).toContain('applyHeroImageToHomeHtml')
    expect(src).toContain('const fromPrompt = extractHttpUrl(opts.prompt)')
    expect(src).not.toContain('Model omitted the attached hero URL')
  })
})
