import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Every API route is either guarded or explicitly declared public.
 *
 * This exists because two unauthenticated routes shipped and sat in production
 * unnoticed: one served ADMIN_BYPASS_SECRET to anonymous callers, the other let
 * anyone delete a contractor's pricing using an id that is public by design.
 * Neither was a subtle bug — they were simply never looked at, because nothing
 * enumerated the surface. 114 route files, 3 of which had any test at all.
 *
 * A census is the right shape here: the failure mode is a route nobody thought
 * about, so the test has to start from the filesystem rather than from a list
 * someone remembers to update. Adding a public route is still fine — it just
 * has to be a decision, written down here, rather than an omission.
 */

const REPO = join(__dirname, '..', '..', '..')

/** Anything that establishes who is calling, or proves the caller is us. */
const GUARDS = [
  'requireAdmin',
  'getCurrentAdmin',
  'requireAdminApi',
  'resolveDomainActor',
  'assertEntitled',
  'assertTextPipelineAccess',
  'assertPremiumAiAccess',
  'assertDepositPaid',
  'getSupabaseServer',
  'getSessionUser',
  // Cron routes authenticate with a shared secret; webhooks verify a signature.
  'CRON_SECRET',
  'constructEvent',
  'verifyTwilioSignature',
  'isOracleExecution',
  // Intake routes are bearer-authenticated by an unguessable token in the path.
  'getIntakeByToken',
  'assertDraftIntake',
  // Wraps resolveDomainActor and refuses anything but the owning contractor.
  'loadOwnedSiteContent',
  // Reads through the caller's own session so RLS scopes the rows.
  'loadOwnLeads',
  // Single-use emailed tokens: password reset and email change.
  'findValidAuthEmailToken',
  // Shared-secret headers for the scraper control plane and inbound webhooks.
  'assertControlPlaneToken',
  'assertWebhookToken',
  'validateTwilioSignature',
  // Resend delivery receipts, verified as an HMAC over the raw body.
  'verifyResendSignature',
]

/**
 * Routes that are public on purpose, each with the reason it is safe.
 *
 * Adding to this list is the deliberate act the test exists to force. If a
 * route here later grows a destructive side effect, that is the moment to move
 * it out — not the moment to widen the list.
 */
const PUBLIC_ROUTES: Record<string, string> = {
  'src/app/api/settings/route.ts':
    'widget branding + pricing for an embedded calculator; entitlement-gated inside',
  'src/app/api/settings/[id]/route.ts': 'same payload addressed by path',
  'src/app/api/calculate/route.ts': 'quote math for the embedded widget; entitlement-gated inside',
  'src/app/api/menu-items/route.ts': 'public menu for order-model tenants',
  'src/app/api/send-lead/route.ts': 'widget lead capture; entitlement + rate limit inside',
  'src/app/api/send-order/route.ts': 'widget order capture; entitlement + rate limit inside',
  'src/app/api/booking/book/route.ts': 'widget booking capture; entitlement-gated inside',
  'src/app/api/booking/availability/route.ts': 'public availability for the booking widget',
  'src/app/api/tickets/purchase/route.ts': 'widget ticket purchase; entitlement-gated inside',
  'src/app/api/tickets/events/route.ts': 'public event list for the ticket widget',
  'src/app/api/intake/public/start/route.ts': 'public signup funnel; Turnstile + rate limited',
  'src/app/api/intake/public/resend-verification/route.ts': 'email re-send for a pending signup',
  'src/app/api/health/graphile/route.ts': 'liveness probe for external monitoring',
  'src/app/api/quality/template-canaries/route.ts': 'canary list consumed by monitoring',
  'src/app/api/offer/[token]/route.ts':
    'the unguessable offer token in the path is the credential; rate-limited per token',
  'src/app/api/catalog/custom-industries/route.ts':
    'read-only list of contractor-contributed industry names, shown in the public intake dropdown',
  'src/app/api/auth/password/request/route.ts':
    'starts a password reset by emailing a token; rate-limited and replies identically whether or not the account exists',
  'src/app/api/auth/email-change/request/route.ts':
    'emails a confirmation to the address already on file; rate-limited and reveals nothing about the account',
}

function routeFiles(): string[] {
  return execSync('find src/app/api -name "route.ts" -o -name "route.tsx"', {
    cwd: REPO,
    encoding: 'utf8',
  })
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .sort()
}

const files = routeFiles()

describe('API route guard census', () => {
  it('finds the route surface', () => {
    expect(files.length).toBeGreaterThan(100)
  })

  it('guards every route that is not declared public', () => {
    const unguarded = files.filter((file) => {
      if (PUBLIC_ROUTES[file]) return false
      const source = readFileSync(join(REPO, file), 'utf8')
      return !GUARDS.some((guard) => source.includes(guard))
    })

    expect(
      unguarded,
      'these routes reference no guard and are not in PUBLIC_ROUTES — add a guard, or declare them public with a reason'
    ).toEqual([])
  })

  it('keeps the public list honest', () => {
    const stale = Object.keys(PUBLIC_ROUTES).filter((f) => !files.includes(f))
    expect(stale, 'PUBLIC_ROUTES names routes that no longer exist').toEqual([])
    for (const [file, reason] of Object.entries(PUBLIC_ROUTES)) {
      expect(reason.length, `${file} needs a real reason`).toBeGreaterThan(20)
    }
  })
})
