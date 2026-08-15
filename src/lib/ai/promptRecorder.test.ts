import { describe, expect, it } from 'vitest'
import {
  formatPromptsForDownload,
  getRecordedPrompts,
  isRecordingPrompts,
  recordPrompt,
  withPromptRecording,
  type RecordedPrompt,
} from './promptRecorder'

function entry(over: Partial<RecordedPrompt> = {}): Omit<RecordedPrompt, 'at'> {
  return {
    pass: 'foundation',
    provider: 'anthropic',
    model: 'claude-opus-5',
    endpoint: null,
    systemPrompt: 'SYSTEM',
    userPrompt: 'USER',
    imageCount: 0,
    durationMs: 1234,
    ok: true,
    ...over,
  }
}

describe('promptRecorder', () => {
  it('records nothing outside a scope, so other callers are unaffected', () => {
    expect(isRecordingPrompts()).toBe(false)
    recordPrompt(entry())
    expect(getRecordedPrompts()).toEqual([])
  })

  it('captures calls in order inside a scope', async () => {
    const captured = await withPromptRecording(async () => {
      recordPrompt(entry({ pass: 'brief' }))
      recordPrompt(entry({ pass: 'page:/about', provider: 'openai', model: 'gpt-5.6-sol' }))
      return getRecordedPrompts()
    })
    expect(captured.map((p) => p.pass)).toEqual(['brief', 'page:/about'])
    expect(captured[1].model).toBe('gpt-5.6-sol')
    expect(captured[0].at).toMatch(/^\d{4}-/)
  })

  it('keeps concurrent runs separate', async () => {
    const [a, b] = await Promise.all([
      withPromptRecording(async () => {
        recordPrompt(entry({ pass: 'run-a' }))
        await new Promise((r) => setTimeout(r, 5))
        return getRecordedPrompts()
      }),
      withPromptRecording(async () => {
        recordPrompt(entry({ pass: 'run-b' }))
        return getRecordedPrompts()
      }),
    ])
    expect(a.map((p) => p.pass)).toEqual(['run-a'])
    expect(b.map((p) => p.pass)).toEqual(['run-b'])
  })

  it('reuses the outer recorder when scopes nest', async () => {
    const captured = await withPromptRecording(async () => {
      recordPrompt(entry({ pass: 'outer' }))
      await withPromptRecording(async () => {
        recordPrompt(entry({ pass: 'inner' }))
      })
      return getRecordedPrompts()
    })
    expect(captured.map((p) => p.pass)).toEqual(['outer', 'inner'])
  })

  it('clamps a runaway prompt rather than storing it whole', async () => {
    const captured = await withPromptRecording(async () => {
      recordPrompt(entry({ userPrompt: 'x'.repeat(80_000) }))
      return getRecordedPrompts()
    })
    expect(captured[0].userPrompt.length).toBeLessThan(80_000)
    expect(captured[0].userPrompt).toContain('[truncated')
  })

  it('caps how many calls one run can store', async () => {
    const captured = await withPromptRecording(async () => {
      for (let i = 0; i < 60; i++) recordPrompt(entry({ pass: `p${i}` }))
      return getRecordedPrompts()
    })
    expect(captured.length).toBe(40)
  })

  it('renders a download that names each pass and its model', () => {
    const text = formatPromptsForDownload(
      [
        { ...entry({ pass: 'brief' }), at: '2026-08-15T20:00:00.000Z' },
        {
          ...entry({ pass: 'page:/about', endpoint: 'openai-platform', ok: false }),
          at: '2026-08-15T20:01:00.000Z',
        },
      ],
      { brandName: "Alvarado's", runId: 'run-1', startedAt: '2026-08-15T20:00:00.000Z' }
    )
    expect(text).toContain("Site:     Alvarado's")
    expect(text).toContain('1. brief — anthropic/claude-opus-5')
    expect(text).toContain('endpoint: openai-platform')
    expect(text).toContain('FAILED')
    expect(text).toContain('--- SYSTEM PROMPT ---')
    expect(text).toContain('--- USER PROMPT ---')
  })
})
