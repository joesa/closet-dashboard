import { NextResponse } from 'next/server'

const DEFAULT_EXTRA_HEADERS = ['x-webhook-token', 'x-api-key']

/**
 * Extract bearer token or custom header token from an incoming webhook/control request.
 */
export function extractBearerOrHeaderToken(
  req: Request,
  extraHeaders: string[] = DEFAULT_EXTRA_HEADERS
): string {
  const auth = req.headers.get('authorization') || ''
  if (/^bearer\s+/i.test(auth)) {
    return auth.replace(/^bearer\s+/i, '').trim()
  }
  if (auth.trim()) return auth.trim()

  for (const name of extraHeaders) {
    const value = req.headers.get(name)
    if (value?.trim()) return value.trim()
  }

  return ''
}

/**
 * Returns a NextResponse error if the token is missing or invalid; null if OK.
 */
export function assertWebhookToken(
  req: Request,
  expected: string | undefined,
  options?: {
    missingEnvMessage?: string
    extraHeaders?: string[]
  }
): NextResponse | null {
  if (!expected) {
    return NextResponse.json(
      { error: options?.missingEnvMessage ?? 'Webhook token is not configured' },
      { status: 500 }
    )
  }

  const incoming = extractBearerOrHeaderToken(req, options?.extraHeaders)
  if (!incoming || incoming !== expected) {
    return NextResponse.json({ error: 'Unauthorized webhook token' }, { status: 401 })
  }

  return null
}
