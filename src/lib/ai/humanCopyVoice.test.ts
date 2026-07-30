import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import {
  AI_TELL_PHRASES,
  HUMAN_COPY_VOICE_RULES,
  HUMAN_COPY_VOICE_RULES_SURGICAL,
} from './humanCopyVoice'

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
})
