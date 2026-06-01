# Stripe production checklist (P0)

Before paid marketing:

1. `npm run stripe:catalog` with live `STRIPE_SECRET_KEY`
2. Set all `STRIPE_PRICE_*`, `INTAKE_*`, `WIDGET_*`, `SITE_MAINTENANCE_*` on Vercel production
3. Single `NEXT_PUBLIC_SITE_URL` = `https://www.closetquotes.com` (no duplicate localhost)
4. Live webhook: `https://www.closetquotes.com/api/webhooks/stripe` + `STRIPE_WEBHOOK_SECRET`
5. Archive duplicate ClosetQuote Pro product in Dashboard
6. `npm run stripe:verify` against production env
7. P0 smoke: trial signup, skip-trial Pro, get-started widget → signup, full-site intake + premium deposit
