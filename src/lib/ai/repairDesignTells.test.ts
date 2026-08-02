import { describe, expect, it, vi } from 'vitest'
import type { CustomSiteConfig } from '@/lib/customSite'
import {
  applyRepairedUnits,
  rejectRepairedUnit,
  repairDesignTells,
  unitIdForGlobalCss,
  unitIdForPage,
  unitsFromDraft,
  type RepairUnits,
} from './repairDesignTells'
import type { DesignTellFinding } from '@/lib/validation/designTellScanner'
import type { UnitQualityReport } from '@/lib/ai/generateWithQualityRetry'

const CSS_UNIT = unitIdForGlobalCss()
const HOME_UNIT = unitIdForPage('/')

const FONTS = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Karla">'
// Needs >= MIN_PAGE_TEXT (80) characters of visible text to count as a usable page.
const HOME = `${FONTS}<header><nav><a href="/">Home</a><a href="/about">About</a></nav></header><main><section><h1>Walk-in closets in Green Hills</h1><img src="https://cdn.example/a.jpg"><p>We hang 3/4 inch birch ply carcasses on Blum hinges, and a typical walk-in takes 6 to 8 weeks from template to install.</p></section></main><!-- CLOSET_WIDGET --><footer>Call 615-555-0188</footer>`
const CSS = ':root{--bg:#eef2f1;--ink:#1a1f1e;--muted:#5a6562;--line:#c5d0cc;--acc:#2f5d50}'

const GLASS_FINDING: DesignTellFinding = {
  code: 'design_glassmorphism',
  unitId: 'globalCss',
  severity: 'error',
  message: 'Glassmorphism cards are banned.',
  fix: 'Remove backdrop-filter and the translucent fills.',
  samples: ['backdrop-filter:blur(12px)'],
}

/** Fails the css unit until its content stops mentioning backdrop-filter. */
function scanForGlass(units: RepairUnits): UnitQualityReport {
  const bad = Object.entries(units).filter(([, v]) => /backdrop-filter/i.test(v))
  return {
    status: bad.length > 0 ? 'failed' : 'passed',
    findings: bad.map(([unitId]) => ({
      unitId,
      code: 'design_glassmorphism',
      message: 'Glassmorphism cards are banned.',
      samples: [],
    })),
    failedUnitIds: bad.map(([unitId]) => unitId),
  }
}

function baseOpts(units: RepairUnits, callModel: ReturnType<typeof vi.fn>) {
  return {
    units,
    findings: [GLASS_FINDING],
    brandName: 'Ridgeline Closets',
    directionBlock: 'Signature: shop-ticket ledger',
    pageHints: '/, /about, /contact',
    callModel: callModel as never,
    scan: scanForGlass,
  }
}

describe('unit plumbing', () => {
  const draft: CustomSiteConfig = {
    mode: 'inline',
    globalCss: CSS,
    pages: { '/': { html: HOME }, '/about': { html: '<section><p>About</p></section>' } },
  }

  it('extracts globalCss and the named pages', () => {
    const units = unitsFromDraft(draft, ['/'])
    expect(Object.keys(units).sort()).toEqual([CSS_UNIT, HOME_UNIT].sort())
  })

  it('merges repaired units back without disturbing other pages', () => {
    const next = applyRepairedUnits(draft, { [HOME_UNIT]: `${HOME}<!-- fixed -->` })
    expect(next.pages['/'].html).toContain('<!-- fixed -->')
    expect(next.pages['/about'].html).toBe('<section><p>About</p></section>')
    expect(next.globalCss).toBe(CSS)
  })

  it('refuses to write unusable HTML into the draft', () => {
    const next = applyRepairedUnits(draft, { [HOME_UNIT]: '<p>x</p>' })
    expect(next.pages['/'].html).toBe(HOME)
  })
})

describe('rejectRepairedUnit', () => {
  it('accepts a clean repair', () => {
    expect(
      rejectRepairedUnit(HOME_UNIT, HOME, HOME.replace('6 to 8 weeks', '7 to 9 weeks'))
    ).toBeNull()
  })

  it('rejects a repair that drops the widget mount', () => {
    const stripped = HOME.replace('<!-- CLOSET_WIDGET -->', '')
    expect(rejectRepairedUnit(HOME_UNIT, HOME, stripped)).toMatch(/widget mount/)
  })

  it('rejects a repair that drops the fonts link', () => {
    expect(rejectRepairedUnit(HOME_UNIT, HOME, HOME.replace(FONTS, ''))).toMatch(/Fonts/)
  })

  it('rejects a repair that drops an image URL', () => {
    const noImg = HOME.replace('<img src="https://cdn.example/a.jpg">', '')
    expect(rejectRepairedUnit(HOME_UNIT, HOME, noImg)).toMatch(/image URL/)
  })

  it('rejects empty content', () => {
    expect(rejectRepairedUnit(HOME_UNIT, HOME, '   ')).toMatch(/empty/)
  })

  it('rejects a css repair that guts the token block', () => {
    expect(rejectRepairedUnit(CSS_UNIT, CSS, ':root{--bg:#fff}')).toMatch(/design tokens/)
  })

  it('allows css to change while keeping its tokens', () => {
    expect(rejectRepairedUnit(CSS_UNIT, CSS, `${CSS}\n.card{border:0}`)).toBeNull()
  })
})

describe('repairDesignTells', () => {
  it('makes no model call when nothing is failing', async () => {
    const callModel = vi.fn()
    const result = await repairDesignTells(baseOpts({ [CSS_UNIT]: CSS }, callModel))
    expect(callModel).not.toHaveBeenCalled()
    expect(result.repairedUnitIds).toEqual([])
    expect(result.report.status).toBe('passed')
  })

  it('repairs only the failing unit and leaves the rest alone', async () => {
    const dirty = `${CSS}\n.card{backdrop-filter:blur(12px);background:rgba(255,255,255,.6)}`
    const callModel = vi.fn(async () => ({ [CSS_UNIT]: CSS }))
    const result = await repairDesignTells(
      baseOpts({ [CSS_UNIT]: dirty, [HOME_UNIT]: HOME }, callModel)
    )
    expect(callModel).toHaveBeenCalledTimes(1)
    expect(result.units[CSS_UNIT]).toBe(CSS)
    expect(result.units[HOME_UNIT]).toBe(HOME)
    expect(result.repairedUnitIds).toEqual([CSS_UNIT])
    expect(result.report.status).toBe('passed')
  })

  it('hands the model the violation text and the locked direction', async () => {
    const dirty = `${CSS}\n.card{backdrop-filter:blur(12px)}`
    const callModel = vi.fn(
      async (_args: { systemPrompt: string; userPrompt: string }) => ({ [CSS_UNIT]: CSS })
    )
    await repairDesignTells(baseOpts({ [CSS_UNIT]: dirty }, callModel))
    const args = callModel.mock.calls[0]![0]
    expect(args.userPrompt).toContain('Remove backdrop-filter')
    expect(args.userPrompt).toContain('shop-ticket ledger')
    expect(args.userPrompt).toContain(CSS_UNIT)
    expect(args.systemPrompt).toContain('CLOSET_WIDGET')
  })

  it('rolls back a repair that breaks an invariant, and says so', async () => {
    const dirtyHome = HOME.replace('<section>', '<section style="backdrop-filter:blur(4px)">')
    const callModel = vi.fn(async () => ({
      // Fixes the tell but silently drops the widget mount and the image.
      [HOME_UNIT]: HOME.replace('<!-- CLOSET_WIDGET -->', '').replace(
        '<img src="https://cdn.example/a.jpg">',
        ''
      ),
    }))
    const result = await repairDesignTells(baseOpts({ [HOME_UNIT]: dirtyHome }, callModel))
    expect(result.units[HOME_UNIT]).toBe(dirtyHome)
    expect(result.rolledBackUnitIds).toEqual([HOME_UNIT])
    expect(result.warnings.join(' ')).toMatch(/widget mount/)
    // The tell survives, which is correct: it is reported rather than hidden.
    expect(result.report.status).toBe('failed')
  })

  it('stops after the attempt cap when the model keeps failing', async () => {
    const dirty = `${CSS}\n.card{backdrop-filter:blur(12px)}`
    const callModel = vi.fn(async () => ({ [CSS_UNIT]: `${CSS}\n.card{backdrop-filter:blur(8px)}` }))
    const result = await repairDesignTells(baseOpts({ [CSS_UNIT]: dirty }, callModel), )
    expect(callModel).toHaveBeenCalledTimes(2)
    expect(result.attempts).toBe(3)
    expect(result.report.status).toBe('failed')
  })

  it('breaks immediately when the model echoes its input', async () => {
    const dirty = `${CSS}\n.card{backdrop-filter:blur(12px)}`
    const callModel = vi.fn(async () => ({ [CSS_UNIT]: dirty }))
    await repairDesignTells(baseOpts({ [CSS_UNIT]: dirty }, callModel))
    expect(callModel).toHaveBeenCalledTimes(1)
  })

  it('surfaces a model error instead of throwing', async () => {
    const dirty = `${CSS}\n.card{backdrop-filter:blur(12px)}`
    const callModel = vi.fn(async () => {
      throw new Error('model timed out')
    })
    const result = await repairDesignTells(baseOpts({ [CSS_UNIT]: dirty }, callModel))
    expect(result.units[CSS_UNIT]).toBe(dirty)
    expect(result.warnings.join(' ')).toMatch(/model timed out/)
  })
})
