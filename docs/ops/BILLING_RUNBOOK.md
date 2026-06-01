# Billing runbook (ClosetQuote)

Ops reference for intake, site builds, and Stripe. Automated flows are in-app; use Dashboard fallbacks when needed.

**Local testing:** step-by-step E2E guide → [LOCAL_E2E_TESTING.md](./LOCAL_E2E_TESTING.md).

## Stripe catalog

- Run locally (test): `npm run stripe:catalog` with `STRIPE_SECRET_KEY` from `.env.local`
- Run for production: same command with **live** secret key; copy price IDs to Vercel
- Verify: `npm run stripe:verify` and production `GET /api/admin/stripe-health`
- Archive duplicate **May 21** ClosetQuote Pro product in Dashboard; keep **Jun 1** `cq_pro_*` prices in env

## Widget (ClosetQuote Pro)

| Flow | Path |
|------|------|
| 30-day trial | `/signup` → dashboard, no card |
| Skip trial | `/signup?subscribe=1&plan=monthly\|yearly` → Stripe → webhook sets `active` |

## Site build intake

| Stage | Customer action | Admin |
|-------|-----------------|-------|
| Start | `/get-started` or `/get-started?tier=standard\|ai_premium` | Create link in `/admin/intakes` |
| Widget-only | `/signup` (not intake) | — |
| AI Premium deposit | Auto on tier select or Pay deposit on intake | Refund: intake detail → **Refund deposit** |
| Preview QA | Wait | **Mark preview approved** → emails pay link |
| Standard $999 / Premium balance | **Pay to launch** on `/intake/[token]` | Manual: Payment Link with `STRIPE_PRICE_STANDARD_BUILD` or `STRIPE_PRICE_AI_PREMIUM_BALANCE` |
| Site live | — | **Mark site live** → unlocks maintenance checkout |
| Maintenance | Pay maintenance on intake | Manual: `STRIPE_PRICE_SITE_MAINTENANCE_*` subscription |

## Premium deposit refund (not satisfied)

1. Prefer **Refund deposit** on `/admin/intakes/[id]` (Stripe refund + `deposit_status=refunded`)
2. Or Stripe Dashboard → payment → refund
3. Email prospect that deposit was returned

## Escalation

- Admin intakes: `/admin/intakes` and `/admin/intakes/[id]`
- Stripe events: `/admin/stripe-events`
- Contact: admin@closetquotes.com
