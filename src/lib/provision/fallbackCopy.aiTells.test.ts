/**
 * Build-time guard (plan: eliminate AI tells, Phase 0): every hardcoded
 * fallback-copy constant that can reach a live site must be free of banned
 * AI-tell phrases, placeholder text, formulaic generator titles, and em dashes
 * in short chrome copy. If this test fails, fix the copy — never the test.
 *
 * The renderer has a twin for its chrome string pools
 * (custom-closets-websites/src/lib/chromeCopy.aiTells.test.ts).
 */
import { describe, expect, it } from 'vitest'
import {
  findAiTellPhrases,
  findFormulaicTitles,
  findPlaceholderTells,
  hasEmDashInShortCopy,
} from '@/lib/ai/humanCopyVoice'
import { ALL_SERVICES } from '@/lib/catalog/industries/index'
import { DEFAULT_QUIZ_CONFIG } from '@/lib/ai/generateQuizConfig'
import { CLOSET_SERVICE_CATALOG } from '@/lib/provision/provisionTenant'
import {
  buildDefaultAbout,
  buildDefaultBeforeAfterCopy,
  buildDefaultProcess,
  buildFallbackHeadline,
  defaultProductSpecs,
} from '@/lib/provision/defaultCopy'
import { buildProvisionSignature } from '@/lib/provision/siteSignature'

const SEEDS = Array.from({ length: 40 }, (_, i) => `guard-seed-${i}`)
const ENGAGEMENT_MODELS = ['quote', 'order', 'booking', 'ticket']

function expectClean(label: string, text: string) {
  expect(findAiTellPhrases(text), `${label}: AI tell in ${JSON.stringify(text)}`).toEqual([])
  expect(findPlaceholderTells(text), `${label}: placeholder in ${JSON.stringify(text)}`).toEqual([])
}

function expectCleanChrome(label: string, text: string) {
  expectClean(label, text)
  expect(
    hasEmDashInShortCopy(text),
    `${label}: em dash in short copy ${JSON.stringify(text)}`
  ).toBe(false)
}

describe('hardcoded fallback copy carries no AI tells', () => {
  it('provisionTenant closet service catalog', () => {
    for (const [name, entry] of Object.entries(CLOSET_SERVICE_CATALOG)) {
      expectCleanChrome(`CLOSET_SERVICE_CATALOG[${name}]`, entry.description)
    }
  })

  it('industry catalogs (all verticals)', () => {
    for (const svc of ALL_SERVICES) {
      expectCleanChrome(`catalog[${svc.industry}/${svc.label}]`, svc.catalog.description)
    }
  })

  it('default quiz config', () => {
    expectCleanChrome('quiz.eyebrow', DEFAULT_QUIZ_CONFIG.eyebrow)
    expectCleanChrome('quiz.headline', DEFAULT_QUIZ_CONFIG.headline)
    for (const q of DEFAULT_QUIZ_CONFIG.questions) {
      expectCleanChrome(`quiz.${q.id}.title`, q.title)
      for (const opt of q.options) expectCleanChrome(`quiz.${q.id}.${opt.id}`, opt.label)
    }
  })

  it('fallback headline never uses an em dash', () => {
    for (const opts of [
      { businessName: 'Summit Interiors', primaryService: 'Walk-In Closets' },
      { businessName: 'Summit Interiors', primaryService: 'Roof Repair', serviceArea: 'Austin' },
      { businessName: 'Summit Interiors' },
      { businessName: 'Summit Interiors', locality: 'Mesa' },
    ]) {
      expectCleanChrome('buildFallbackHeadline', buildFallbackHeadline(opts))
    }
  })

  it('default about copy (all verticals x seeds)', () => {
    for (const seed of SEEDS) {
      for (const industry of [null, 'medical-clinic', 'dental', 'roofing']) {
        const about = buildDefaultAbout('Summit Interiors', 'Walk-In Closets', 'Austin', seed, industry)
        expectClean(`about[${industry}]`, about.description)
      }
    }
  })

  it('default process copy (all models x seeds)', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      for (const model of ENGAGEMENT_MODELS) {
        for (const industry of [null, 'medical-clinic']) {
          const proc = buildDefaultProcess(model, 'Walk-In Closets', seed, industry)
          expectCleanChrome(`process[${model}].title`, proc.title)
          expectCleanChrome(`process[${model}].subtitle`, proc.subtitle)
          for (const step of proc.steps) {
            expectCleanChrome(`process[${model}].step.title`, step.title)
            expectClean(`process[${model}].step.desc`, step.description)
          }
        }
      }
    }
  })

  it('default product specs are never the identical rule-of-three trio', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      for (const model of ENGAGEMENT_MODELS) {
        const specs = defaultProductSpecs(model, 'Walk-In Closets', null, seed)
        expect(specs.length, `specs[${model}] should be 2 or 4 items`).not.toBe(3)
        for (const spec of specs) expectCleanChrome(`specs[${model}]`, spec)
      }
    }
  })

  it('before/after copy pool', () => {
    for (const seed of SEEDS) {
      const copy = buildDefaultBeforeAfterCopy(seed)
      expectCleanChrome('beforeAfter.title', copy.title)
      expectCleanChrome('beforeAfter.subtitle', copy.subtitle)
    }
  })

  it('provision signature pools (eyebrows + process titles, all verticals)', () => {
    const verticals: Array<{ industry: string | null; services: string[] }> = [
      { industry: null, services: ['Walk-In Closets'] },
      { industry: 'medical clinic', services: ['Pediatric Care'] },
      { industry: 'day spa', services: ['Massage'] },
      { industry: 'law firm', services: ['Estate Planning'] },
    ]
    for (const seed of SEEDS) {
      for (const v of verticals) {
        const sig = buildProvisionSignature({
          businessName: 'Summit Interiors',
          seed,
          industry: v.industry,
          services: v.services,
        })
        expectCleanChrome(`signature.eyebrow[${v.industry}]`, sig.eyebrow)
        expectCleanChrome(`signature.processName[${v.industry}]`, sig.processName)
        expect(
          findFormulaicTitles(sig.processName),
          `formulaic process title: ${sig.processName}`
        ).toEqual([])
      }
    }
  })
})
