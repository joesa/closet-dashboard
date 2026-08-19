import { describe, expect, it } from 'vitest'
import {
  clientLoginUrl,
  generateTempPassword,
} from './clientLoginCredentials'

describe('clientLoginCredentials', () => {
  it('generates a 12-char password from the allowed alphabet', () => {
    // The alphabet widened when this moved onto the crypto-backed generator:
    // it adds -_=+ and drops the ambiguous lookalikes (0/O, 1/l/I) so a
    // customer can read the password out of an email without guessing. The old
    // pattern here omitted the new symbols, so it failed only when one happened
    // to be drawn — a flake that hid behind a passing suite. Asserted over many
    // samples rather than one, since a single draw proves nothing about a range.
    for (let i = 0; i < 200; i += 1) {
      const pw = generateTempPassword()
      expect(pw).toHaveLength(12)
      expect(pw).toMatch(/^[a-zA-Z2-9!@#$%^&*\-_=+]+$/)
      expect(pw).not.toMatch(/[0O1lI]/)
    }
  })

  it('builds a login URL from an origin', () => {
    expect(clientLoginUrl('https://www.ditchtheform.com/')).toBe(
      'https://www.ditchtheform.com/login'
    )
  })
})
