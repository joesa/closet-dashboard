import { verifyTurnstileToken } from '@/lib/turnstile'

/**
 * Captcha check for the four public write routes the widget calls:
 * send-lead, booking/book, send-order and tickets/purchase.
 *
 * Staged deliberately. These endpoints are called by widget bundles already
 * embedded on customers' sites, and those bundles do not send a Turnstile
 * token yet — demanding one today would break every live installation and take
 * the lead form, which is the product, down with it. So:
 *
 *   - a token that is present is always verified, and a bad one is rejected;
 *   - a missing token is allowed until TURNSTILE_REQUIRE_WIDGET is set to '1'.
 *
 * That makes the server side ready now and the switch a one-line ops change
 * once widgets are sending tokens. Until then these routes still have the
 * atomic fail-closed rate limiter and the entitlement gate in front of them.
 */

export type CaptchaResult = { ok: true } | { ok: false; status: number; error: string }

export function widgetCaptchaRequired(): boolean {
  return process.env.TURNSTILE_REQUIRE_WIDGET?.trim() === '1'
}

export async function checkWidgetCaptcha(
  token: unknown,
  remoteIp?: string
): Promise<CaptchaResult> {
  const supplied = typeof token === 'string' ? token.trim() : ''

  if (!supplied) {
    if (widgetCaptchaRequired()) {
      return { ok: false, status: 400, error: 'Captcha verification is required.' }
    }
    return { ok: true }
  }

  const passed = await verifyTurnstileToken(supplied, remoteIp)
  if (!passed) {
    return { ok: false, status: 403, error: 'Captcha verification failed.' }
  }
  return { ok: true }
}
