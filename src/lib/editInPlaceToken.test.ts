import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  mintEditInPlaceToken,
  verifyEditInPlaceToken,
} from './editInPlaceToken'

describe('editInPlaceToken', () => {
  const prev = process.env.ADMIN_BYPASS_SECRET

  beforeEach(() => {
    process.env.ADMIN_BYPASS_SECRET = 'test-secret-for-edit-in-place'
  })

  afterEach(() => {
    if (prev === undefined) delete process.env.ADMIN_BYPASS_SECRET
    else process.env.ADMIN_BYPASS_SECRET = prev
  })

  it('mints and verifies a token for the same tenant', () => {
    const token = mintEditInPlaceToken('tenant-1')
    expect(verifyEditInPlaceToken(token, 'tenant-1')).toBe(true)
    expect(verifyEditInPlaceToken(token, 'other')).toBe(false)
  })

  it('rejects tampered tokens', () => {
    const token = mintEditInPlaceToken('tenant-1')
    const [payload] = token.split('.')
    expect(verifyEditInPlaceToken(`${payload}.aaaa`, 'tenant-1')).toBe(false)
  })
})
