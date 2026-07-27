import { describe, expect, it } from 'vitest'
import {
  assertTokenKind,
  hashAuthToken,
  isTokenExpired,
} from './emailTokens'
import { normalizeEmail, isDemoAuthEmail } from './authUserLookup'

describe('emailTokens helpers', () => {
  it('hashes tokens stably', () => {
    expect(hashAuthToken('abc')).toBe(hashAuthToken('abc'))
    expect(hashAuthToken('abc')).not.toBe(hashAuthToken('abd'))
  })

  it('detects expiry', () => {
    const past = new Date(Date.now() - 1000).toISOString()
    const future = new Date(Date.now() + 60_000).toISOString()
    expect(isTokenExpired(past)).toBe(true)
    expect(isTokenExpired(future)).toBe(false)
  })

  it('assertTokenKind rejects consumed/expired/wrong kind', () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    expect(
      assertTokenKind(
        { kind: 'password_verify', consumed_at: null, expires_at: future },
        'password_verify'
      )
    ).toBe(true)
    expect(
      assertTokenKind(
        {
          kind: 'password_verify',
          consumed_at: new Date().toISOString(),
          expires_at: future,
        },
        'password_verify'
      )
    ).toBe(false)
    expect(
      assertTokenKind(
        { kind: 'password_reset', consumed_at: null, expires_at: future },
        'password_verify'
      )
    ).toBe(false)
  })
})

describe('authUserLookup helpers', () => {
  it('normalizes email', () => {
    expect(normalizeEmail('  Foo@Bar.COM ')).toBe('foo@bar.com')
  })

  it('detects demo email', () => {
    expect(isDemoAuthEmail('demo@ditchtheform.com')).toBe(true)
    expect(isDemoAuthEmail('other@example.com')).toBe(false)
  })
})

describe('email change status machine (logical)', () => {
  const transitions: Record<string, string[]> = {
    awaiting_old_confirm: ['pending_admin', 'cancelled'],
    pending_admin: ['approved', 'rejected', 'cancelled'],
    approved: ['completed'],
    rejected: [],
    completed: [],
    cancelled: [],
  }

  it('allows the planned status edges', () => {
    expect(transitions.awaiting_old_confirm).toContain('pending_admin')
    expect(transitions.pending_admin).toContain('approved')
    expect(transitions.approved).toContain('completed')
    expect(transitions.pending_admin).not.toContain('completed')
  })
})
