import { createHmac } from 'node:crypto'

/**
 * Validate Twilio's X-Twilio-Signature for an incoming webhook.
 * @see https://www.twilio.com/docs/usage/security#validating-requests
 */
export function validateTwilioSignature(options: {
  authToken: string | undefined
  signature: string
  url: string
  params: URLSearchParams
}): boolean {
  const { authToken, signature, url, params } = options
  if (!authToken?.trim()) {
    // Misconfigured — reject rather than accept unsigned traffic.
    return false
  }
  if (!signature?.trim() || !url?.trim()) return false

  // Twilio signs: URL + sorted param name/value concatenation (no separators).
  const keys = [...params.keys()].sort()
  let data = url
  for (const key of keys) {
    data += key + (params.get(key) ?? '')
  }

  const expected = createHmac('sha1', authToken).update(Buffer.from(data, 'utf8')).digest('base64')

  // Timing-safe compare
  if (expected.length !== signature.length) return false
  let mismatch = 0
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return mismatch === 0
}
