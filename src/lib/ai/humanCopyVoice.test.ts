import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import {
  HUMAN_COPY_VOICE_RULES,
  HUMAN_COPY_VOICE_RULES_SURGICAL,
} from './humanCopyVoice'

describe('humanCopyVoice', () => {
  it('bans common AI marketing tells', () => {
    for (const phrase of ['Elevate', 'Seamless', 'Unleash', 'Look no further', 'one-stop shop']) {
      expect(HUMAN_COPY_VOICE_RULES).toContain(phrase)
      expect(HUMAN_COPY_VOICE_RULES_SURGICAL).toMatch(new RegExp(phrase, 'i'))
    }
  })

  it('is wired into intake site generation on Claude Sonnet', () => {
    const src = readFileSync(join(__dirname, 'generateSiteConfig.ts'), 'utf8')
    expect(src).toContain('HUMAN_COPY_VOICE_RULES')
    expect(src).toContain("preferredProvider: 'anthropic'")
    expect(src).toContain('CLAUDE_SONNET_MODEL')
  })
})
