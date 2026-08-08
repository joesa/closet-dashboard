import { createHash } from 'node:crypto'
import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import {
  AI_TELL_PHRASES,
  AI_TELL_RULES,
  HUMAN_COPY_VOICE_RULES,
  HUMAN_COPY_VOICE_RULES_SURGICAL,
  findAiTellPhrases,
  findFormulaicTitles,
  findPlaceholderTells,
  hasEmDashInShortCopy,
} from './humanCopyVoice'

/**
 * CANONICAL HASH of the shared AI-tell rule table. The renderer pins the exact
 * same literal in custom-closets-websites/src/lib/humanCopyVoice.test.ts. If
 * either repo edits its table without mirroring the change, that repo's test
 * fails — same drift-guard pattern as designFingerprint.
 */
const AI_TELL_CANON_HASH = 'a2d010856f7c4834'

describe('humanCopyVoice', () => {
  it('bans common AI marketing tells', () => {
    // Case-insensitive: the ban applies to the phrase, not to one capitalisation
    // of it. AI_TELL_PHRASES stores canonical lower-case forms.
    for (const phrase of ['Elevate', 'Seamless', 'Unleash', 'Look no further', 'one-stop shop']) {
      expect(HUMAN_COPY_VOICE_RULES).toMatch(new RegExp(phrase, 'i'))
      expect(HUMAN_COPY_VOICE_RULES_SURGICAL).toMatch(new RegExp(phrase, 'i'))
    }
  })

  it('renders every machine-readable ban into the prompt', () => {
    // The gate in specificityGate.ts scans for AI_TELL_PHRASES. If a phrase were
    // enforced there but missing from the prompt, generation would be penalised
    // for something it was never told to avoid.
    expect(AI_TELL_PHRASES.length).toBeGreaterThan(20)
    for (const phrase of AI_TELL_PHRASES) {
      expect(HUMAN_COPY_VOICE_RULES.toLowerCase()).toContain(phrase.toLowerCase())
    }
  })

  it('is wired into intake site generation on Claude Sonnet', () => {
    const src = readFileSync(join(__dirname, 'generateSiteConfig.ts'), 'utf8')
    expect(src).toContain('HUMAN_COPY_VOICE_RULES')
    expect(src).toContain("preferredProvider: 'anthropic'")
    expect(src).toContain('CLAUDE_SONNET_MODEL')
  })

  it('matches the canonical cross-repo rule table (renderer mirror)', () => {
    const canon = JSON.stringify(
      AI_TELL_RULES.map((r) => [r.phrase, ...(r.allowedContexts ?? []).map(String)])
    )
    const hash = createHash('sha256').update(canon).digest('hex').slice(0, 16)
    expect(hash).toBe(AI_TELL_CANON_HASH)
  })

  it('keeps trade exemptions working after the table merge', () => {
    expect(findAiTellPhrases('Seamless gutters installed in a day')).toEqual([])
    expect(findAiTellPhrases('A seamless experience')).toEqual(['seamless'])
    expect(findAiTellPhrases('a testament to our craft')).toEqual(['testament to'])
  })

  it('detects placeholder tells', () => {
    expect(findPlaceholderTells('Contact Jane Doe at jane@example.com')).toEqual([
      'Jane Doe',
      'jane@example.com',
    ])
    expect(findPlaceholderTells('Offering 3 — lorem body')).toContain('Offering 3')
    expect(findPlaceholderTells('We have plenty to do this week')).toEqual([])
  })

  it('detects em dashes in short chrome copy but not prose', () => {
    expect(hasEmDashInShortCopy('Free estimates — book today')).toBe(true)
    expect(
      hasEmDashInShortCopy(
        'The crew arrived before eight and had the framing squared by lunch — which mattered, because the inspector was booked for two and the drywall delivery was already sitting in the driveway waiting on his sign-off.'
      )
    ).toBe(false)
  })

  it('detects formulaic generator titles', () => {
    expect(findFormulaicTitles('The Summit Method')).toEqual(['The Summit Method'])
    expect(findFormulaicTitles('The Rivera Care Approach')).toEqual([
      'The Rivera Care Approach',
    ])
    expect(findFormulaicTitles('How we plan your build')).toEqual([])
  })
})
