import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { verifyTurnstileToken } from './turnstile'

/**
 * The interesting case is the unconfigured one: this used to return true, so
 * losing the env var turned the captcha off everywhere and only said so in a
 * log line nobody reads.
 */
// NODE_ENV is typed read-only, so it is stubbed via vi.stubEnv and restored by
// unstubAllEnvs rather than saved and reassigned like the others.
const ENV_KEYS = ['TURNSTILE_SECRET', 'TURNSTILE_SECRET_KEY'] as const
const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const key of ENV_KEYS) saved[key] = process.env[key]
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

function stubSiteverify(success: boolean) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success })))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('verifyTurnstileToken', () => {
  it('rejects in production when no secret is configured', async () => {
    delete process.env.TURNSTILE_SECRET
    delete process.env.TURNSTILE_SECRET_KEY
    vi.stubEnv('NODE_ENV', 'production')
    await expect(verifyTurnstileToken('any-token')).resolves.toBe(false)
  })

  it('skips verification outside production so a local checkout still works', async () => {
    delete process.env.TURNSTILE_SECRET
    delete process.env.TURNSTILE_SECRET_KEY
    vi.stubEnv('NODE_ENV', 'development')
    await expect(verifyTurnstileToken('any-token')).resolves.toBe(true)
  })

  it('rejects an empty token when a secret is configured', async () => {
    process.env.TURNSTILE_SECRET = 'sekret'
    const fetchMock = stubSiteverify(true)
    await expect(verifyTurnstileToken('   ')).resolves.toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects the dev-bypass sentinel', async () => {
    process.env.TURNSTILE_SECRET = 'sekret'
    await expect(verifyTurnstileToken('dev-bypass')).resolves.toBe(false)
  })

  it('accepts a token Cloudflare confirms', async () => {
    process.env.TURNSTILE_SECRET = 'sekret'
    stubSiteverify(true)
    await expect(verifyTurnstileToken('good-token')).resolves.toBe(true)
  })

  it('rejects a token Cloudflare denies', async () => {
    process.env.TURNSTILE_SECRET = 'sekret'
    stubSiteverify(false)
    await expect(verifyTurnstileToken('bad-token')).resolves.toBe(false)
  })

  it('rejects when siteverify itself is unreachable, rather than allowing through', async () => {
    process.env.TURNSTILE_SECRET = 'sekret'
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))
    await expect(verifyTurnstileToken('good-token')).resolves.toBe(false)
  })

  it('falls back to the legacy TURNSTILE_SECRET_KEY name', async () => {
    delete process.env.TURNSTILE_SECRET
    process.env.TURNSTILE_SECRET_KEY = 'legacy'
    const fetchMock = stubSiteverify(true)
    await expect(verifyTurnstileToken('good-token')).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalled()
  })
})
