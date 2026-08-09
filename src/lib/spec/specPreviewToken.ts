import { createHmac } from 'node:crypto'

/**
 * A per-tenant, expiring key that lets one business owner see the one site we
 * built for them.
 *
 * Never use `admin_bypass` for this. ADMIN_BYPASS_SECRET is a single global
 * value: handing it to a prospect in an SMS would give them — and anyone they
 * forwarded the message to — preview access to every gated tenant on the
 * platform, including paying customers mid-build. This token is scoped to one
 * tenant and expires, so the worst case of a forwarded link is that a stranger
 * sees one spec site that was going to be deleted anyway.
 *
 * Signed with its own secret so rotating it cannot disturb admin access, and
 * vice versa.
 */
function secret(): string {
  const value =
    process.env.SPEC_PREVIEW_SECRET?.trim() || process.env.CONTENT_EDITOR_SECRET?.trim()
  if (!value) throw new Error('SPEC_PREVIEW_SECRET is not configured')
  return value
}

/** Default TTL covers the 7-day offer plus the purge grace window. */
const DEFAULT_TTL_SECONDS = 9 * 24 * 60 * 60

export function mintSpecPreviewToken(tenantId: string, ttlSeconds = DEFAULT_TTL_SECONDS): string {
  const payload = Buffer.from(
    JSON.stringify({
      tenantId,
      kind: 'spec_preview',
      exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    })
  ).toString('base64url')
  const signature = createHmac('sha256', secret()).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export function specPreviewConfigured(): boolean {
  return !!(process.env.SPEC_PREVIEW_SECRET?.trim() || process.env.CONTENT_EDITOR_SECRET?.trim())
}
