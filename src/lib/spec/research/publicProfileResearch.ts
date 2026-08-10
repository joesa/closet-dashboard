import type { PublicProfileResearch } from '@/lib/spec/types'

const MIN_TEXT_CHARS = 120
const MAX_TEXT_CHARS = 12_000
const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/i
const PHONE_RE = /(?:\+?\d[\s().-]{0,2}){9,}\d/

export function withoutPublicProfileResearch<T extends { publicProfileResearch?: unknown }>(
  lead: T
): Omit<T, 'publicProfileResearch'> {
  const { publicProfileResearch: _discarded, ...retained } = lead
  return retained
}

function profileIdentity(value: string): { platform: string; id: string } | null {
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:') return null
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
    const platform = host === 'facebook.com' || host === 'm.facebook.com'
      ? 'facebook'
      : host === 'yelp.com' && parsed.pathname.toLowerCase().startsWith('/biz/')
        ? 'yelp'
        : null
    if (!platform) return null
    const id = parsed.pathname.toLowerCase() === '/profile.php'
      ? parsed.searchParams.get('id')?.trim()
      : platform === 'yelp'
        ? parsed.pathname.split('/').filter(Boolean)[1]?.trim()
        : parsed.pathname.split('/').filter(Boolean)[0]?.trim()
    return id ? { platform, id: id.toLowerCase() } : null
  } catch {
    return null
  }
}

export function publicProfileSourceKind(sourceUrl: string): 'facebook_about' | 'yelp_business' | null {
  const identity = profileIdentity(sourceUrl)
  if (identity?.platform === 'facebook') return 'facebook_about'
  if (identity?.platform === 'yelp') return 'yelp_business'
  return null
}

/** Defense in depth for authenticated scraper payloads before durable storage. */
export function normalizePublicProfileResearch(
  value: unknown,
  expectedProfileUrls?: string | null | Array<string | null | undefined>
): PublicProfileResearch | null {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !expectedProfileUrls) return null
  const raw = value as Record<string, unknown>
  if (raw.captureMethod !== 'public_browser') return null
  if (typeof raw.sourceUrl !== 'string' || typeof raw.text !== 'string') return null
  if (typeof raw.capturedAt !== 'string' || !Number.isFinite(Date.parse(raw.capturedAt))) return null

  const source = profileIdentity(raw.sourceUrl)
  const expectedValues = Array.isArray(expectedProfileUrls) ? expectedProfileUrls : [expectedProfileUrls]
  const matchesExpected = source && expectedValues.some((url) => {
    if (!url) return false
    const expected = profileIdentity(url)
    return expected?.platform === source.platform && expected.id === source.id
  })
  if (!matchesExpected) {
    return null
  }

  const text = raw.text.trim()
  if (text.length < MIN_TEXT_CHARS || text.length > MAX_TEXT_CHARS) return null
  if (EMAIL_RE.test(text) || PHONE_RE.test(text) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) {
    return null
  }

  return {
    sourceUrl: raw.sourceUrl,
    text,
    capturedAt: new Date(raw.capturedAt).toISOString(),
    captureMethod: 'public_browser',
  }
}