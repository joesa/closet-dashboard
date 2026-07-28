/**
 * Short-lived HMAC tokens so the edit-in-place UI on a tenant hostname can
 * call dashboard save/upload APIs without sharing admin session cookies
 * across subdomains. Token is only accepted while site_configs.edit_in_place
 * is true (enforced by callers).
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

const DEFAULT_TTL_SEC = 60 * 60 * 8 // 8 hours

function secret(): string {
  const s = process.env.ADMIN_BYPASS_SECRET?.trim()
  if (!s) throw new Error('ADMIN_BYPASS_SECRET is not configured')
  return s
}

function b64url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad
  return Buffer.from(b64, 'base64')
}

export function mintEditInPlaceToken(
  tenantId: string,
  ttlSec: number = DEFAULT_TTL_SEC
): string {
  const exp = Math.floor(Date.now() / 1000) + Math.max(60, ttlSec)
  const payload = `${tenantId}:${exp}`
  const sig = createHmac('sha256', secret()).update(payload).digest()
  return `${b64url(Buffer.from(payload, 'utf8'))}.${b64url(sig)}`
}

export function verifyEditInPlaceToken(
  token: string | null | undefined,
  tenantId: string
): boolean {
  if (!token || !tenantId) return false
  const parts = token.split('.')
  if (parts.length !== 2) return false
  let payload: string
  let sig: Buffer
  try {
    payload = fromB64url(parts[0]).toString('utf8')
    sig = fromB64url(parts[1])
  } catch {
    return false
  }
  const [tid, expStr] = payload.split(':')
  if (tid !== tenantId) return false
  const exp = Number(expStr)
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false
  let expected: Buffer
  try {
    expected = createHmac('sha256', secret()).update(payload).digest()
  } catch {
    return false
  }
  if (expected.length !== sig.length) return false
  return timingSafeEqual(expected, sig)
}

/** Read Bearer token or X-Edit-In-Place-Token header. */
export function readEditInPlaceToken(req: Request): string | null {
  const auth = req.headers.get('authorization') || ''
  const m = /^Bearer\s+(.+)$/i.exec(auth)
  if (m?.[1]) return m[1].trim()
  const hdr = req.headers.get('x-edit-in-place-token')
  return hdr?.trim() || null
}
