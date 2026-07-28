import { describe, expect, it } from 'vitest'
import { generateStrongPassword } from './generateStrongPassword'

describe('generateStrongPassword', () => {
  it('returns the requested length (default 16)', () => {
    expect(generateStrongPassword()).toHaveLength(16)
    expect(generateStrongPassword(20)).toHaveLength(20)
  })

  it('includes lower, upper, digit, and symbol', () => {
    // Run a few times — each password must satisfy the classes.
    for (let i = 0; i < 20; i++) {
      const pw = generateStrongPassword(16)
      expect(pw).toMatch(/[a-z]/)
      expect(pw).toMatch(/[A-Z]/)
      expect(pw).toMatch(/[0-9]/)
      expect(pw).toMatch(/[!@#$%^&*\-_=+]/)
    }
  })

  it('avoids ambiguous lookalikes 0 O 1 l I', () => {
    for (let i = 0; i < 30; i++) {
      const pw = generateStrongPassword(24)
      expect(pw).not.toMatch(/[0O1lI]/)
    }
  })
})
