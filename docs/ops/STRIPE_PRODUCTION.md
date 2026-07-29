# Stripe production checklist (P0)

## Critical: test vs live (do not mix)

Stripe **price IDs are mode-specific**. A `price_…` created with `sk_test_…` only works with a **test** secret key. The same ID is invalid under `sk_live_…` (API: “No such price”).

| Lane | Secret | Where prices come from |
|------|--------|------------------------|
| Local / Preview | `sk_test_…` in `.env.local` | `npm run stripe:catalog` (default) |
| Production (go-live) | `sk_live_…` on Vercel Production | **Same command** but with the **live** secret |

There is **no** `STRIPE_SECRET_KEY_LIVE` (or similar) in this repo. Live catalog is a manual swap: put the live secret in the env used by `stripe:catalog`, run it, then copy the **new** `STRIPE_PRICE_*` IDs to Vercel Production.

### Status note (2026-07-28)

- `.env.local` uses **`sk_test_`** / **`pk_test_`**.
- Recent pricing sync wrote **test-mode** `STRIPE_PRICE_*` (e.g. `STRIPE_PRICE_STANDARD_BUILD=price_1TyLSYPF63Qjxbbb5L2S9M0U`, `livemode=false`) into **Vercel Production**.
- Vercel marks `STRIPE_*` as **sensitive**, so `vercel env pull` returns empty values — confirm Production `STRIPE_SECRET_KEY` prefix in the Vercel UI (`sk_test_` vs `sk_live_`).
- If Production secret is still **test**: those price IDs are valid for that mode (site is not yet on live Stripe).
- If Production secret is **live**: those IDs are **invalid** — re-run catalog with live key and overwrite all `STRIPE_PRICE_*` (and publishable/webhook secrets) on Vercel before taking paid traffic.

## Before paid marketing

1. `npm run stripe:catalog` with live `STRIPE_SECRET_KEY` (not the test key from `.env.local`)
2. Set all `STRIPE_PRICE_*`, `INTAKE_*`, `WIDGET_*`, `SITE_MAINTENANCE_*` on Vercel production to the **live** IDs/amounts from that run
3. Set `STRIPE_SECRET_KEY` = `sk_live_…` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = `pk_live_…`
4. Single `NEXT_PUBLIC_SITE_URL` = `https://www.ditchtheform.com` (no duplicate localhost)
5. Live webhook: `https://www.ditchtheform.com/api/webhooks/stripe` + live `STRIPE_WEBHOOK_SECRET`
6. Archive duplicate DitchTheForm Pro product in Dashboard
7. `npm run stripe:verify` against an env that has the **live** secret + live price IDs (do not verify live deploy with `.env.local` test key alone)
8. P0 smoke: trial signup, skip-trial Pro, get-started widget → signup, full-site intake + premium deposit
