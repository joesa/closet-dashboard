import { describe, expect, it } from 'vitest'
import { DEDUP_WINDOW_MS, findRecentDuplicate } from './findRecentDuplicate'

const NOW = Date.parse('2026-08-19T12:00:00Z')
const at = (msAgo: number) => new Date(NOW - msAgo).toISOString()

describe('findRecentDuplicate', () => {
  it('finds nothing when there are no earlier leads', () => {
    expect(findRecentDuplicate([], NOW)).toBeNull()
  })

  it('matches a submission from an hour ago', () => {
    expect(findRecentDuplicate([{ id: 'a', created_at: at(3_600_000) }], NOW)).toBe('a')
  })

  it('ignores one from just outside the 24h window', () => {
    expect(findRecentDuplicate([{ id: 'a', created_at: at(DEDUP_WINDOW_MS + 1000) }], NOW)).toBeNull()
  })

  it('still matches at the edge of the window', () => {
    expect(findRecentDuplicate([{ id: 'a', created_at: at(DEDUP_WINDOW_MS - 1000) }], NOW)).toBe('a')
  })

  it('picks the most recent of several', () => {
    const rows = [
      { id: 'old', created_at: at(20 * 3_600_000) },
      { id: 'recent', created_at: at(2 * 3_600_000) },
      { id: 'middle', created_at: at(9 * 3_600_000) },
    ]
    expect(findRecentDuplicate(rows, NOW)).toBe('recent')
  })

  it('flattens the chain: repeating a duplicate points at the original', () => {
    const rows = [{ id: 'second', created_at: at(3_600_000), duplicate_of: 'first' }]
    expect(findRecentDuplicate(rows, NOW)).toBe('first')
  })

  it('ignores a row with an unparseable timestamp instead of throwing', () => {
    const rows = [{ id: 'bad', created_at: 'not a date' }, { id: 'good', created_at: at(1000) }]
    expect(findRecentDuplicate(rows, NOW)).toBe('good')
  })

  it('ignores a future-dated row (clock skew is not a duplicate)', () => {
    expect(findRecentDuplicate([{ id: 'a', created_at: at(-60_000) }], NOW)).toBeNull()
  })

  it('honors a caller-supplied window', () => {
    const rows = [{ id: 'a', created_at: at(2 * 3_600_000) }]
    expect(findRecentDuplicate(rows, NOW, 3_600_000)).toBeNull()
    expect(findRecentDuplicate(rows, NOW, 6 * 3_600_000)).toBe('a')
  })
})
