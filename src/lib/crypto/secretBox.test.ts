import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  decryptSecret,
  encryptSecret,
  secretBoxConfigured,
  secretHint,
  SecretBoxError,
  secretsEqual,
} from './secretBox'

const KEY_A = Buffer.alloc(32, 1).toString('base64')
const KEY_B = Buffer.alloc(32, 2).toString('base64')

describe('secretBox', () => {
  const prev = process.env.AI_CONFIG_KEY

  beforeEach(() => {
    process.env.AI_CONFIG_KEY = KEY_A
  })

  afterEach(() => {
    if (prev === undefined) delete process.env.AI_CONFIG_KEY
    else process.env.AI_CONFIG_KEY = prev
  })

  it('round trips a secret', () => {
    const secret = 'sk-ant-api03-not-a-real-key'
    expect(decryptSecret(encryptSecret(secret))).toBe(secret)
  })

  it('produces a different ciphertext each time (random iv)', () => {
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'))
  })

  it('accepts a hex key as well as base64', () => {
    process.env.AI_CONFIG_KEY = Buffer.alloc(32, 3).toString('hex')
    expect(decryptSecret(encryptSecret('hex-keyed'))).toBe('hex-keyed')
  })

  it('rejects a tampered ciphertext rather than returning garbage', () => {
    const payload = encryptSecret('tamper-me')
    const [v, iv, tag, data] = payload.split('.')
    const flipped = Buffer.from(data!, 'base64url')
    flipped[0] ^= 0xff
    const bad = [v, iv, tag, flipped.toString('base64url')].join('.')
    expect(() => decryptSecret(bad)).toThrow(SecretBoxError)
  })

  it('fails closed when the key changed since the secret was stored', () => {
    const payload = encryptSecret('rotated')
    process.env.AI_CONFIG_KEY = KEY_B
    expect(() => decryptSecret(payload)).toThrow(/AI_CONFIG_KEY may have changed/)
  })

  it('rejects malformed payloads', () => {
    expect(() => decryptSecret('nonsense')).toThrow(SecretBoxError)
    expect(() => decryptSecret('v9.a.b.c')).toThrow(/Unsupported secret format/)
  })

  it('reports whether a usable key is configured', () => {
    expect(secretBoxConfigured()).toBe(true)
    process.env.AI_CONFIG_KEY = 'too-short'
    expect(secretBoxConfigured()).toBe(false)
    delete process.env.AI_CONFIG_KEY
    expect(secretBoxConfigured()).toBe(false)
    expect(() => encryptSecret('x')).toThrow(/AI_CONFIG_KEY is not set/)
  })

  it('masks a key for display without revealing it', () => {
    expect(secretHint('sk-ant-api03-abcd1234')).toBe('••••1234')
    expect(secretHint('abc')).toBe('••••')
  })

  it('compares secrets without leaking length-independent timing', () => {
    expect(secretsEqual('token', 'token')).toBe(true)
    expect(secretsEqual('token', 'other')).toBe(false)
    expect(secretsEqual('token', 'token-longer')).toBe(false)
  })
})
