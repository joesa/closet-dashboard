export async function verifyTurnstileToken(token: string, remoteIp?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    // Dev: allow when Turnstile is not configured
    return process.env.NODE_ENV !== 'production'
  }

  const body = new URLSearchParams({
    secret,
    response: token,
  })
  if (remoteIp) body.set('remoteip', remoteIp)

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  const json = (await res.json()) as { success?: boolean }
  return !!json.success
}
