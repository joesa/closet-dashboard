import { createHash, randomBytes } from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

export type AuthEmailTokenKind =
  | 'password_verify'
  | 'password_reset'
  | 'email_change_confirm_old'
  | 'email_change_ack_old'

export type AuthEmailTokenRow = {
  id: string
  kind: AuthEmailTokenKind
  email: string
  user_id: string | null
  contractor_id: string | null
  payload: Record<string, unknown>
  expires_at: string
  consumed_at: string | null
}

export function hashAuthToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export function generateRawAuthToken(): string {
  return randomBytes(32).toString('base64url')
}

const DEFAULT_TTL_MS: Record<AuthEmailTokenKind, number> = {
  password_verify: 60 * 60 * 1000,
  password_reset: 30 * 60 * 1000,
  email_change_confirm_old: 60 * 60 * 1000,
  email_change_ack_old: 60 * 60 * 1000,
}

export async function createAuthEmailToken(opts: {
  kind: AuthEmailTokenKind
  email: string
  userId?: string | null
  contractorId?: string | null
  payload?: Record<string, unknown>
  ttlMs?: number
}): Promise<{ raw: string; id: string; expiresAt: string }> {
  const supabase = getSupabaseAdmin()
  const raw = generateRawAuthToken()
  const tokenHash = hashAuthToken(raw)
  const ttl = opts.ttlMs ?? DEFAULT_TTL_MS[opts.kind]
  const expiresAt = new Date(Date.now() + ttl).toISOString()

  const { data, error } = await supabase
    .from('auth_email_tokens')
    .insert({
      kind: opts.kind,
      email: opts.email.trim().toLowerCase(),
      user_id: opts.userId || null,
      contractor_id: opts.contractorId || null,
      payload: opts.payload || {},
      token_hash: tokenHash,
      expires_at: expiresAt,
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`Failed to create auth token: ${error?.message || 'unknown'}`)
  }

  return { raw, id: data.id as string, expiresAt }
}

export async function findValidAuthEmailToken(
  raw: string,
  kind?: AuthEmailTokenKind | AuthEmailTokenKind[]
): Promise<AuthEmailTokenRow | null> {
  const supabase = getSupabaseAdmin()
  const tokenHash = hashAuthToken(raw)
  const { data, error } = await supabase
    .from('auth_email_tokens')
    .select(
      'id, kind, email, user_id, contractor_id, payload, expires_at, consumed_at'
    )
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error || !data) return null
  if (data.consumed_at) return null
  if (new Date(data.expires_at).getTime() < Date.now()) return null

  const kinds = kind
    ? Array.isArray(kind)
      ? kind
      : [kind]
    : null
  if (kinds && !kinds.includes(data.kind as AuthEmailTokenKind)) return null

  return {
    id: data.id,
    kind: data.kind as AuthEmailTokenKind,
    email: data.email,
    user_id: data.user_id,
    contractor_id: data.contractor_id,
    payload: (data.payload || {}) as Record<string, unknown>,
    expires_at: data.expires_at,
    consumed_at: data.consumed_at,
  }
}

export async function consumeAuthEmailToken(id: string): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('auth_email_tokens')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', id)
    .is('consumed_at', null)
    .select('id')
    .maybeSingle()

  return !error && !!data
}

/** Pure helpers for unit tests (no DB). */
export function isTokenExpired(expiresAt: string, now = Date.now()): boolean {
  return new Date(expiresAt).getTime() < now
}

export function assertTokenKind(
  row: { kind: string; consumed_at: string | null; expires_at: string },
  expected: AuthEmailTokenKind | AuthEmailTokenKind[],
  now = Date.now()
): boolean {
  if (row.consumed_at) return false
  if (isTokenExpired(row.expires_at, now)) return false
  const kinds = Array.isArray(expected) ? expected : [expected]
  return kinds.includes(row.kind as AuthEmailTokenKind)
}
