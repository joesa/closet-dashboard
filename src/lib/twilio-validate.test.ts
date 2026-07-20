import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { validateTwilioSignature } from './twilio-validate'

function sign(authToken: string, url: string, params: URLSearchParams): string {
  const keys = [...params.keys()].sort()
  let data = url
  for (const key of keys) {
    data += key + (params.get(key) ?? '')
  }
  return createHmac('sha1', authToken).update(Buffer.from(data, 'utf8')).digest('base64')
}

describe('validateTwilioSignature', () => {
  const authToken = 'test-auth-token'
  const url = 'https://example.com/api/webhooks/twilio'

  it('accepts a valid signature', () => {
    const params = new URLSearchParams({ From: '+15551234567', Body: 'stop' })
    const signature = sign(authToken, url, params)
    expect(
      validateTwilioSignature({ authToken, signature, url, params })
    ).toBe(true)
  })

  it('rejects an invalid signature', () => {
    const params = new URLSearchParams({ From: '+15551234567', Body: 'stop' })
    expect(
      validateTwilioSignature({
        authToken,
        signature: 'bogus',
        url,
        params,
      })
    ).toBe(false)
  })

  it('rejects when auth token is missing', () => {
    const params = new URLSearchParams({ From: '+15551234567', Body: 'hi' })
    expect(
      validateTwilioSignature({
        authToken: undefined,
        signature: 'x',
        url,
        params,
      })
    ).toBe(false)
  })
})
