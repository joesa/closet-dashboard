import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  plannedDirectionKeys,
  releaseDesignDirectionReservation,
  reserveDesignDirection,
} from './directionReservation'

const direction = {
  typography: { display: 'Fraunces', body: 'Karla' },
  palette: [
    { role: 'bg', hex: '#eef2f1' },
    { role: 'ink', hex: '#1a1f1e' },
    { role: 'acc', hex: '#2f5d50' },
  ],
  composition: 'Asymmetric editorial canvas',
  signatureElement: 'Oversized vertical wordmark',
}

function clientWith(result: { data?: unknown; error?: { message: string } | null }) {
  const rpc = vi.fn().mockResolvedValue({
    data: result.data ?? null,
    error: result.error ?? null,
  })
  return { client: { rpc } as unknown as SupabaseClient, rpc }
}

describe('plannedDirectionKeys', () => {
  it('is stable across palette order and whitespace differences', () => {
    const first = plannedDirectionKeys(direction)
    const second = plannedDirectionKeys({
      ...direction,
      composition: '  Asymmetric   editorial canvas ',
      palette: [...direction.palette].reverse(),
    })
    expect(second.directionKey).toBe(first.directionKey)
    expect(first.fontKey).toBe('fraunces+karla')
  })
})

describe('reserveDesignDirection', () => {
  it('returns the reservation created by the atomic RPC', async () => {
    const { client, rpc } = clientWith({
      data: [{ id: 'reservation-1', expires_at: '2026-08-08T05:00:00.000Z' }],
    })
    const result = await reserveDesignDirection({
      supabase: client,
      tenantId: 'tenant-1',
      jobKey: 'job-1',
      direction,
    })
    expect(result).toMatchObject({
      status: 'reserved',
      reservation: { id: 'reservation-1' },
    })
    expect(rpc).toHaveBeenCalledWith(
      'reserve_custom_design_direction',
      expect.objectContaining({
        p_tenant_id: 'tenant-1',
        p_job_key: 'job-1',
        p_font_key: 'fraunces+karla',
      })
    )
  })

  it('distinguishes a direction conflict from registry unavailability', async () => {
    const conflict = clientWith({ data: [] })
    await expect(reserveDesignDirection({
      supabase: conflict.client,
      tenantId: 'tenant-1',
      jobKey: 'job-1',
      direction,
    })).resolves.toEqual({ status: 'conflict' })

    const unavailable = clientWith({ error: { message: 'network down' } })
    await expect(reserveDesignDirection({
      supabase: unavailable.client,
      tenantId: 'tenant-1',
      jobKey: 'job-1',
      direction,
    })).resolves.toEqual({ status: 'unavailable' })
  })

  it('releases a reservation through the lifecycle RPC', async () => {
    const { client, rpc } = clientWith({ data: null })
    await releaseDesignDirectionReservation(client, 'reservation-1')
    expect(rpc).toHaveBeenCalledWith(
      'finish_custom_design_direction_reservation',
      { p_reservation_id: 'reservation-1', p_status: 'released' }
    )
  })
})

describe('reservation schema', () => {
  const migration = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260808120000_design_direction_reservations.sql'),
    'utf8'
  )

  it('uses partial active uniqueness and transactional publishing', () => {
    expect(migration).toContain('idx_custom_design_direction_active')
    expect(migration).toContain("WHERE status = 'reserved'")
    expect(migration).toContain('publish_custom_site_with_fingerprint')
    expect(migration).toContain('ON CONFLICT (tenant_id, status, artifact_hash)')
  })
})