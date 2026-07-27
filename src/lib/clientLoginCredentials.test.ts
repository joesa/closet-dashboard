import { describe, expect, it } from 'vitest'
import {
  clientLoginUrl,
  generateTempPassword,
} from './clientLoginCredentials'

describe('clientLoginCredentials', () => {
  it('generates a 12-char password from the allowed alphabet', () => {
    const pw = generateTempPassword()
    expect(pw).toHaveLength(12)
    expect(pw).toMatch(/^[a-zA-Z0-9!@#$%^&*]+$/)
  })

  it('builds a login URL from an origin', () => {
    expect(clientLoginUrl('https://www.ditchtheform.com/')).toBe(
      'https://www.ditchtheform.com/login'
    )
  })
})
