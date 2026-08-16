import { describe, expect, it } from 'vitest'
import { PublishBlockedError, isPublishBlockedError } from './publishBlocked'

describe('PublishBlockedError', () => {
  const issue = {
    code: 'decorative_numbered_list',
    severity: 'error' as const,
    message: 'Numbered by CSS counters',
  }

  it('carries the blocking issues so the UI can list them', () => {
    const err = new PublishBlockedError('Cannot publish: x', [issue] as never)
    expect(err.issues).toHaveLength(1)
    expect(err.message).toContain('Cannot publish')
    expect(err.name).toBe('PublishBlockedError')
  })

  it('is distinguishable from an ordinary failure, which is the whole point', () => {
    expect(isPublishBlockedError(new PublishBlockedError('x', []))).toBe(true)
    // A real fault must still reach 500 and error monitoring.
    expect(isPublishBlockedError(new Error('database exploded'))).toBe(false)
    expect(isPublishBlockedError('nope')).toBe(false)
  })
})
