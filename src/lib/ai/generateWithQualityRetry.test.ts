import { describe, expect, it, vi } from 'vitest'
import { generateWithQualityRetry } from './generateWithQualityRetry'

describe('generateWithQualityRetry', () => {
  it('regenerates failed units only and preserves accepted siblings', async () => {
    const regenerate = vi.fn().mockResolvedValue({ headline: 'Built for Clarksville rain.' })
    const result = await generateWithQualityRetry({
      initial: { headline: 'Elevate your exterior.', body: 'We install 6-inch gutters.' },
      validate: (output) => output.headline.startsWith('Elevate')
        ? {
            status: 'failed',
            failedUnitIds: ['headline'],
            findings: [{ unitId: 'headline', code: 'copy_ai_tell_phrase', message: 'Blocked phrase', samples: ['Elevate'] }],
          }
        : { status: 'passed', failedUnitIds: [], findings: [] },
      regenerate,
    })

    expect(regenerate).toHaveBeenCalledWith(expect.objectContaining({ failedUnitIds: ['headline'] }))
    expect(result.output).toEqual({
      headline: 'Built for Clarksville rain.',
      body: 'We install 6-inch gutters.',
    })
    expect(result.status).toBe('passed')
    expect(result.attempts).toBe(2)
  })

  it('stops when a retry makes no progress', async () => {
    const result = await generateWithQualityRetry({
      initial: { headline: 'Elevate your exterior.' },
      validate: () => ({
        status: 'failed',
        failedUnitIds: ['headline'],
        findings: [{ unitId: 'headline', code: 'copy_ai_tell_phrase', message: 'Blocked phrase', samples: ['Elevate'] }],
      }),
      regenerate: async () => ({ headline: 'Elevate your exterior.', unknown: 'ignored' }),
    })

    expect(result.status).toBe('failed')
    expect(result.attempts).toBe(2)
    expect(result.output).toEqual({ headline: 'Elevate your exterior.' })
  })

  it('retains the current candidate when targeted regeneration fails', async () => {
    const initial = { headline: 'Elevate your exterior.', body: 'We install 6-inch gutters.' }
    const result = await generateWithQualityRetry({
      initial,
      validate: () => ({
        status: 'failed',
        failedUnitIds: ['headline'],
        findings: [{ unitId: 'headline', code: 'copy_ai_tell_phrase', message: 'Blocked phrase', samples: ['Elevate'] }],
      }),
      regenerate: async () => {
        throw new Error('provider unavailable')
      },
    })

    expect(result.output).toEqual(initial)
    expect(result.status).toBe('failed')
    expect(result.retryError).toBe('provider unavailable')
  })
})