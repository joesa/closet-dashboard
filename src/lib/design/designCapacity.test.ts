import { describe, expect, it } from 'vitest'
import { TYPE_PAIR_POOL } from '@/lib/ai/deterministicDirectionSeed'
import { analyzeDesignCapacity } from './designCapacity'

describe('analyzeDesignCapacity', () => {
  it('warns before preferred capacity exhaustion and detects stale reservations', () => {
    const fingerprints = TYPE_PAIR_POOL.slice(0, 22).map((pair, index) => ({
      font_key: `${pair.display}+${pair.body}`.toLowerCase(),
      updated_at: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    }))
    const report = analyzeDesignCapacity(
      fingerprints,
      [{ status: 'reserved', expires_at: '2026-01-01T00:00:00.000Z' }],
      new Date('2026-01-02T00:00:00.000Z')
    )
    expect(report.candidateCount).toBeGreaterThanOrEqual(500)
    expect(report.preferredUtilization).toBeGreaterThanOrEqual(0.7)
    expect(report.expiredActiveReservations).toBe(1)
    expect(report.warnings).toHaveLength(2)
  })

  it('reports historical pairs outside the compatible pool', () => {
    const report = analyzeDesignCapacity(
      [{ font_key: 'unknown display+unknown body', updated_at: '2026-01-01T00:00:00.000Z' }],
      []
    )
    expect(report.unknownFontKeys).toEqual(['unknown display+unknown body'])
  })
})