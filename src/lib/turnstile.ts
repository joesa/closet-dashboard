/**
 * Cloudflare Turnstile verification for public intake/signup forms.
 *
 * Behavior when keys are missing:
 * - No TURNSTILE_SECRET_KEY → verification is skipped (allow). This keeps
 *   get-started working in environments that have not configured Turnstile yet.
 * - Secret set but token empty/invalid → reject.
 */
export async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim()
  if (!secret) {
    console.warn(
      '[turnstile] TURNSTILE_SECRET_KEY is not set — skipping captcha verification'
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
