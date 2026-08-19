import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkWidgetCaptcha, widgetCaptchaRequired } from './turnstileWidgetGuard'

const saved = { require: process.env.TURNSTILE_REQUIRE_WIDGET, secret: process.env.TURNSTILE_SECRET }

beforeEach(() => {
  process.env.TURNSTILE_SECRET = 'sekret'
  delete process.env.TURNSTILE_REQUIRE_WIDGET
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  if (saved.require === undefined) delete process.env.TURNSTILE_REQUIRE_WIDGET
  else process.env.TURNSTILE_REQUIRE_WIDGET = saved.require
  if (saved.secret === undefined) delete process.env.TURNSTILE_SECRET
  else process.env.TURNSTILE_SECRET = saved.secret
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function siteverify(success: boolean) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success }))))
}

describe('checkWidgetCaptcha', () => {
  it('allows a request with no token while the requirement is off', async () => {
    // Every widget bundle in the wild today is in exactly this state.
    await expect(checkWidgetCaptcha(undefined)).resolves.toEqual({ ok: true })
  })

  it('rejects a request with no token once the requirement is on', async () => {
    process.env.TURNSTILE_REQUIRE_WIDGET = '1'
    await expect(checkWidgetCaptcha(undefined)).resolves.toMatchObject({ ok: false, status: 400 })
  })

  it('verifies a token that is supplied even while the requirement is off', async () => {
    siteverify(false)
    await expect(checkWidgetCaptcha('forged')).resolves.toMatchObject({ ok: false, status: 403 })
  })

  it('accepts a token Cloudflare confirms', async () => {
    siteverify(true)
    await expect(checkWidgetCaptcha('good')).resolves.toEqual({ ok: true })
  })

  it('treats a blank string as no token at all', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(checkWidgetCaptcha('   ')).resolves.toEqual({ ok: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ignores a non-string token rather than throwing', async () => {
    await expect(checkWidgetCaptcha({ nope: true })).resolves.toEqual({ ok: true })
  })

  it('reads the requirement flag strictly', () => {
    process.env.TURNSTILE_REQUIRE_WIDGET = 'true'
    expect(widgetCaptchaRequired()).toBe(false)
    process.env.TURNSTILE_REQUIRE_WIDGET = '1'
    expect(widgetCaptchaRequired()).toBe(true)
  })
})
