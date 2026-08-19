import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { TIMESTAMP_TOLERANCE_SECONDS, verifyResendSignature } from './verifyResendSignature'

const SECRET = 'whsec_' + Buffer.from('a-test-signing-key-of-some-length').toString('base64')
const NOW = 1_700_000_000

function sign(body: string, id: string, timestamp: number, secret = SECRET): string {
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  const mac = createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64')
  return `v1,${mac}`
}

const BODY = JSON.stringify({ type: 'email.delivered', data: { email_id: 'abc' } })

function verify(over: Partial<Parameters<typeof verifyResendSignature>[0]> = {}) {
  return verifyResendSignature({
    secret: SECRET,
    body: BODY,
    svixId: 'msg_1',
    svixTimestamp: String(NOW),
    svixSignature: sign(BODY, 'msg_1', NOW),
    nowSeconds: NOW,
    ...over,
  })
}

describe('verifyResendSignature', () => {
  it('accepts a correctly signed payload', () => {
    expect(verify()).toEqual({ ok: true })
  })

  it('accepts when one of several rotated signatures matches', () => {
    const bogus = 'v1,' + Buffer.alloc(32, 1).toString('base64')
    expect(verify({ svixSignature: `${bogus} ${sign(BODY, 'msg_1', NOW)}` })).toEqual({ ok: true })
  })

  it('rejects a tampered body', () => {
    expect(verify({ body: BODY.replace('abc', 'xyz') }).ok).toBe(false)
  })

  it('rejects a signature made with a different secret', () => {
    const other = 'whsec_' + Buffer.from('a-completely-different-key-here!!').toString('base64')
    expect(verify({ svixSignature: sign(BODY, 'msg_1', NOW, other) }).ok).toBe(false)
  })

  it('rejects a replay outside the timestamp tolerance', () => {
    const old = NOW - TIMESTAMP_TOLERANCE_SECONDS - 1
    const result = verify({ svixTimestamp: String(old), svixSignature: sign(BODY, 'msg_1', old) })
    expect(result).toEqual({ ok: false, reason: 'timestamp outside tolerance' })
  })

  it('accepts a timestamp just inside the tolerance', () => {
    const recent = NOW - TIMESTAMP_TOLERANCE_SECONDS + 1
    expect(verify({ svixTimestamp: String(recent), svixSignature: sign(BODY, 'msg_1', recent) })).toEqual(
      { ok: true }
    )
  })

  it('rejects when the id differs from the one that was signed', () => {
    expect(verify({ svixId: 'msg_2' }).ok).toBe(false)
  })

  it.each(['svixId', 'svixTimestamp', 'svixSignature'] as const)('rejects a missing %s', (field) => {
    expect(verify({ [field]: null })).toEqual({ ok: false, reason: 'missing headers' })
  })

  it('rejects a non-numeric timestamp', () => {
    expect(verify({ svixTimestamp: 'not-a-number' })).toEqual({ ok: false, reason: 'bad timestamp' })
  })

  it('rejects a signature of the wrong length without throwing', () => {
    expect(verify({ svixSignature: 'v1,' + Buffer.alloc(8, 9).toString('base64') }).ok).toBe(false)
  })
})
