import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Resend signs webhooks with Svix. Verified by hand rather than by adding the
 * `svix` package: the scheme is an HMAC over three concatenated fields and the
 * dependency would be a supply-chain surface for twenty lines of crypto.
 *
 * The signed payload is `${id}.${timestamp}.${body}`, HMAC-SHA256 with the
 * base64 secret that follows the `whsec_` prefix. The header may carry several
 * space-separated `v1,<sig>` values during a secret rotation, and any one of
 * them matching is a valid signature.
 */

export type VerifyResult = { ok: true } | { ok: false; reason: string }

/** Reject replays. Svix's own default tolerance. */
export const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60

export function verifyResendSignature(opts: {
  secret: string
  body: string
  svixId: string | null
  svixTimestamp: string | null
  svixSignature: string | null
  /** Seconds since epoch; injected so the tolerance is testable. */
  nowSeconds: number
}): VerifyResult {
  const { secret, body, svixId, svixTimestamp, svixSignature, nowSeconds } = opts

  if (!svixId || !svixTimestamp || !svixSignature) return { ok: false, reason: 'missing headers' }

  const timestamp = Number(svixTimestamp)
  if (!Number.isFinite(timestamp)) return { ok: false, reason: 'bad timestamp' }
  if (Math.abs(nowSeconds - timestamp) > TIMESTAMP_TOLERANCE_SECONDS) {
    return { ok: false, reason: 'timestamp outside tolerance' }
  }

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const expected = createHmac('sha256', key).update(`${svixId}.${svixTimestamp}.${body}`).digest()

  for (const part of svixSignature.split(' ')) {
    const [version, value] = part.split(',')
    if (version !== 'v1' || !value) continue
    const provided = Buffer.from(value, 'base64')
    // timingSafeEqual throws on a length mismatch, which is itself a mismatch.
    if (provided.length === expected.length && timingSafeEqual(provided, expected)) {
      return { ok: true }
    }
  }

  return { ok: false, reason: 'no matching signature' }
}
