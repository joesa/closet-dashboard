import {
  TYPE_PAIR_POOL,
  compatibleTypePairs,
} from '@/lib/ai/deterministicDirectionSeed'
import {
  TYPOGRAPHY_PREFERRED_POOL_ALERT_RATIO,
  TYPOGRAPHY_RECENT_WINDOW,
} from '@/lib/validation/designGuardPolicy'

export type FingerprintUsageRow = {
  font_key: string
  updated_at: string
}

export type ReservationUsageRow = {
  status: string
  expires_at: string
}

export type DesignCapacityReport = {
  candidateCount: number
  preferredCount: number
  usedPreferredCount: number
  preferredUtilization: number
  recentUniqueFontCount: number
  unknownFontKeys: string[]
  activeReservations: number
  expiredActiveReservations: number
  warnings: string[]
}

function pairKey(pair: { display: string; body: string }): string {
  return `${pair.display}+${pair.body}`.toLowerCase()
}

export function analyzeDesignCapacity(
  fingerprints: FingerprintUsageRow[],
  reservations: ReservationUsageRow[],
  now = new Date()
): DesignCapacityReport {
  const candidateKeys = new Set(compatibleTypePairs().map(pairKey))
  const preferredKeys = new Set(TYPE_PAIR_POOL.map(pairKey))
  const usedKeys = new Set(fingerprints.map((row) => row.font_key.toLowerCase()))
  const usedPreferredCount = [...preferredKeys].filter((key) => usedKeys.has(key)).length
  const preferredUtilization = preferredKeys.size
    ? usedPreferredCount / preferredKeys.size
    : 0
  const recentUniqueFontCount = new Set(
    [...fingerprints]
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, TYPOGRAPHY_RECENT_WINDOW)
      .map((row) => row.font_key.toLowerCase())
  ).size
  const unknownFontKeys = [...usedKeys].filter((key) => !candidateKeys.has(key)).sort()
  const active = reservations.filter((row) => row.status === 'reserved')
  const expiredActiveReservations = active.filter(
    (row) => Date.parse(row.expires_at) <= now.getTime()
  ).length
  const warnings: string[] = []
  if (preferredUtilization >= TYPOGRAPHY_PREFERRED_POOL_ALERT_RATIO) {
    warnings.push(
      `Preferred typography utilization is ${(preferredUtilization * 100).toFixed(1)}%.`
    )
  }
  if (expiredActiveReservations > 0) {
    warnings.push(`${expiredActiveReservations} active direction reservation(s) are expired.`)
  }
  if (unknownFontKeys.length > 0) {
    warnings.push(`${unknownFontKeys.length} historical font pair(s) are outside the compatible pool.`)
  }
  return {
    candidateCount: candidateKeys.size,
    preferredCount: preferredKeys.size,
    usedPreferredCount,
    preferredUtilization,
    recentUniqueFontCount,
    unknownFontKeys,
    activeReservations: active.length,
    expiredActiveReservations,
    warnings,
  }
}