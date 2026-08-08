import { describe, expect, it } from 'vitest'
import {
  MAX_FULL_REDESIGN_BATCH_SIZE,
  normalizeFullRedesignTenantIds,
} from './batchFullRedesign'

describe('normalizeFullRedesignTenantIds', () => {
  const validId = '123e4567-e89b-42d3-a456-426614174000'

  it('keeps valid UUIDs and removes duplicates', () => {
    expect(normalizeFullRedesignTenantIds([validId, validId])).toEqual([validId])
  })

  it('rejects malformed IDs and non-array input', () => {
    expect(normalizeFullRedesignTenantIds(['tenant-1', null, 42])).toEqual([])
    expect(normalizeFullRedesignTenantIds({ tenantId: validId })).toEqual([])
  })

  it('exposes the API batch limit', () => {
    expect(MAX_FULL_REDESIGN_BATCH_SIZE).toBe(20)
  })
})