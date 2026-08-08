import type { SupabaseClient } from '@supabase/supabase-js'
import { hashSeed } from '@/lib/catalog/designFingerprint'

export type PlannedDesignDirection = {
  typography: { display: string; body: string }
  palette: Array<{ role: string; hex: string }>
  composition: string
  signatureElement: string
}

export type DirectionReservation = {
  id: string
  directionKey: string
  expiresAt: string
}

export type DirectionReservationResult =
  | { status: 'reserved'; reservation: DirectionReservation }
  | { status: 'conflict' }
  | { status: 'unavailable' }

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function plannedDirectionKeys(direction: PlannedDesignDirection): {
  directionKey: string
  fontKey: string
  paletteKey: string
  compositionKey: string
  signatureKey: string
} {
  const fontKey = `${normalize(direction.typography.display)}+${normalize(direction.typography.body)}`
  const paletteKey = direction.palette
    .map((color) => `${normalize(color.role)}:${normalize(color.hex)}`)
    .sort()
    .join('|')
  const compositionKey = normalize(direction.composition)
  const signatureKey = normalize(direction.signatureElement)
  const serialized = [fontKey, paletteKey, compositionKey, signatureKey].join('||')
  return {
    directionKey: hashSeed(serialized).toString(36),
    fontKey,
    paletteKey,
    compositionKey,
    signatureKey,
  }
}

export async function reserveDesignDirection(opts: {
  supabase: SupabaseClient
  tenantId: string
  jobKey: string
  direction: PlannedDesignDirection
  industryKey?: string | null
  marketKey?: string | null
}): Promise<DirectionReservationResult> {
  const keys = plannedDirectionKeys(opts.direction)
  const { data, error } = await opts.supabase.rpc('reserve_custom_design_direction', {
    p_tenant_id: opts.tenantId,
    p_job_key: opts.jobKey,
    p_direction_key: keys.directionKey,
    p_font_key: keys.fontKey,
    p_palette_key: keys.paletteKey,
    p_composition_key: keys.compositionKey,
    p_signature_key: keys.signatureKey,
    p_industry_key: opts.industryKey ?? null,
    p_market_key: opts.marketKey ?? null,
  })
  if (error) {
    console.warn(JSON.stringify({
      event: 'design_reservation_unavailable',
      tenantId: opts.tenantId,
      directionKey: keys.directionKey,
      error: error.message,
    }))
    return { status: 'unavailable' }
  }
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object' || typeof row.id !== 'string') {
    console.info(JSON.stringify({
      event: 'design_reservation_conflict',
      tenantId: opts.tenantId,
      directionKey: keys.directionKey,
    }))
    return { status: 'conflict' }
  }
  const reservation = {
    id: row.id,
    directionKey: keys.directionKey,
    expiresAt: typeof row.expires_at === 'string' ? row.expires_at : '',
  }
  console.info(JSON.stringify({
    event: 'design_candidate_selected',
    tenantId: opts.tenantId,
    directionKey: keys.directionKey,
    reservationId: reservation.id,
  }))
  return { status: 'reserved', reservation }
}

async function setReservationStatus(opts: {
  supabase: SupabaseClient
  reservationId: string
  status: 'consumed' | 'released'
}): Promise<void> {
  const { error } = await opts.supabase.rpc('finish_custom_design_direction_reservation', {
    p_reservation_id: opts.reservationId,
    p_status: opts.status,
  })
  if (error) {
    console.warn(JSON.stringify({
      event: `design_reservation_${opts.status}_failed`,
      reservationId: opts.reservationId,
      error: error.message,
    }))
  }
}

export async function consumeDesignDirectionReservation(
  supabase: SupabaseClient,
  reservationId: string
): Promise<void> {
  await setReservationStatus({ supabase, reservationId, status: 'consumed' })
}

export async function releaseDesignDirectionReservation(
  supabase: SupabaseClient,
  reservationId: string
): Promise<void> {
  await setReservationStatus({ supabase, reservationId, status: 'released' })
}