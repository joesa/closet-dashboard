/**
 * Demo account constants.
 *
 * The public demo contractor (demo@closetquotes.com) is shared on the
 * landing page widget, in the Loom walkthrough, and as a public login
 * for prospects to test-drive the dashboard.
 *
 * Server code that needs to reseed/protect this account reads
 * DEMO_CONTRACTOR_ID. Client code (banners, widget gating) reads the
 * NEXT_PUBLIC_DEMO_CONTRACTOR_ID env var which is hard-coded below as
 * a build-time fallback so the demo banner still renders even if the
 * env var isn't configured.
 */
export const DEMO_CONTRACTOR_ID =
  process.env.NEXT_PUBLIC_DEMO_CONTRACTOR_ID?.trim() ||
  'ec376123-f499-4ad4-88c9-2b63ad6f90ab'

/**
 * Public demo login credentials. These are intentionally exposed on the
 * landing page so prospects can sign into the dashboard without asking
 * for access. The account is sandboxed and reset nightly by the
 * /api/cron/reset-demo job, so leaking the password is by design.
 */
export const DEMO_LOGIN = {
  email: 'demo@closetquotes.com',
  password: 'TryClosetQuote2026!',
}

/**
 * Origins that are allowed to call the API with the demo contractor id.
 * Everything else is rejected by /api/calculate and /api/send-lead — this
 * is the real anti-theft control (the client-side lock can be stripped
 * by anyone who forks widget.js, but they can't fake an Origin header
 * from a script tag they paste on their own domain).
 *
 * Override / extend at build time with DEMO_ALLOWED_ORIGINS (server) or
 * NEXT_PUBLIC_DEMO_ALLOWED_ORIGINS (client) — comma-separated list of
 * full origins like "https://closet-dashboard-orcin.vercel.app".
 */
const RAW_EXTRA_ORIGINS =
  process.env.DEMO_ALLOWED_ORIGINS ||
  process.env.NEXT_PUBLIC_DEMO_ALLOWED_ORIGINS ||
  ''

export const DEMO_ALLOWED_ORIGINS: string[] = Array.from(
  new Set(
    [
      'https://closet-dashboard-orcin.vercel.app',
      'https://closet-widget.vercel.app',
      'https://closetquotes.com',
      'https://www.closetquotes.com',
      // basic-closet-demo (sample contractor site that embeds the demo widget)
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'https://basic-closet-demo.vercel.app',
      ...RAW_EXTRA_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
    ].map((s) => s.toLowerCase().replace(/\/+$/, ''))
  )
)

/**
 * True when the given origin string (typically from `request.headers.get('origin')`
 * or derived from the Referer header) is allowed to call the API on
 * behalf of the demo contractor.
 *
 * Exact matches from DEMO_ALLOWED_ORIGINS always pass. Additionally any
 * `*.closetquotes.com` subdomain (Lumina / Ironclad / Hearth demos) is allowed
 * so aesthetic storefronts can exercise the shared demo widget.
 */
export function isAllowedDemoOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false
  let host: string
  let normalized: string
  try {
    const u = new URL(origin)
    host = u.host.toLowerCase()
    normalized = `${u.protocol}//${host}`.replace(/\/+$/, '')
  } catch {
    normalized = origin.toLowerCase().replace(/\/+$/, '')
    try {
      host = new URL(normalized).host
    } catch {
      host = normalized.replace(/^https?:\/\//, '').split('/')[0] || ''
    }
  }
  if (DEMO_ALLOWED_ORIGINS.includes(normalized)) return true
  return host === 'closetquotes.com' || host.endsWith('.closetquotes.com')
}

/**
 * Human-readable copy for the "this is a demo" notice that appears on
 * the landing page and on the dashboard when the demo user is logged
 * in. Keep this single source so both surfaces stay in sync.
 */
export const DEMO_RESET_NOTICE = {
  short: 'Demo resets every night around midnight Eastern Time.',
  long:
    'Heads up — this is a shared demo account. Any rooms, finishes, ' +
    'add-ons, or pricing changes are wiped and restored to the default ' +
    'demo configuration once a day at 05:00 UTC (midnight–1:00 AM ET, ' +
    'depending on daylight saving).',
}
