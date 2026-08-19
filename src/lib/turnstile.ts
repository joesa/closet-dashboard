/**
 * Cloudflare Turnstile verification for public intake/signup forms.
 *
 * Behavior when keys are missing:
 * - In development, verification is skipped so a local checkout works without
 *   Cloudflare credentials.
 * - In production, a missing secret is a misconfiguration and *rejects*. It
 *   used to return true, which meant that losing the env var silently turned
 *   the captcha off across every public form with nothing but a log line to
 *   show for it — the same fail-open shape the rate limiter had. The secret is
 *   configured on production today, so this changes nothing until it goes
 *   missing, which is exactly the moment it should be noticed.
 * - Secret set but token empty/invalid → reject.
 *
 * Prefers Spin's `TURNSTILE_SECRET`; falls back to legacy `TURNSTILE_SECRET_KEY`.
 */
export async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<boolean> {
  const secret =
    process.env.TURNSTILE_SECRET?.trim() || process.env.TURNSTILE_SECRET_KEY?.trim()
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[turnstile] TURNSTILE_SECRET is not set in production — rejecting')
      return false
    }
    console.warn(
      '[turnstile] TURNSTILE_SECRET is not set — skipping captcha verification (non-production)'
    )
    return true
  }

  const response = (token || '').trim()
  if (!response || response === 'dev-bypass') {
    return false
  }

  const body = new URLSearchParams({
    secret,
    response,
  })
  if (remoteIp) body.set('remoteip', remoteIp)

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const json = (await res.json()) as { success?: boolean; 'error-codes'?: string[] }
    if (!json.success) {
      console.warn('[turnstile] siteverify failed', json['error-codes'] || json)
    }
    return !!json.success
  } catch (err) {
    console.error('[turnstile] siteverify request error', err)
    return false
  }
}
