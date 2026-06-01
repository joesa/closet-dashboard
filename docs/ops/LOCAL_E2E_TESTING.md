# Local end-to-end testing guide

Step-by-step guide for testing the **full pricing funnel** on your machine after the go-live sprints (widget trial, skip-trial Pro, get-started routing, tiered intake, deposit, pay-to-launch, maintenance).

**App URL:** `http://localhost:3000` (set `NEXT_PUBLIC_SITE_URL` to this and **only** this for local runs).

---

## What you are testing

| Lane | Entry | Stripe (test mode) |
|------|--------|-------------------|
| Widget — 30-day trial | `/signup` | None at signup |
| Widget — skip trial | `/signup?subscribe=1&plan=monthly` or `yearly` | Pro subscription |
| Widget from get-started | `/get-started` + “I already have a website” | Redirects to signup (no intake) |
| Standard site build | `/get-started?tier=standard` → intake | $999 after preview approval |
| AI Premium site build | `/get-started?tier=ai_premium` → intake | $600 deposit → $1,399 balance after approval |
| Site maintenance | Intake after build paid + **site live** | Maintenance subscription |

---

## Prerequisites

### 1. Environment

```bash
cd closet-dashboard
cp .env.example .env.local   # if you have not already
```

**Required for all flows:**

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Auth, intake, webhooks |
| `STRIPE_SECRET_KEY` | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | From `stripe listen` (see below) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` |
| All `STRIPE_PRICE_*` | From catalog script (see below) |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` |

**Pricing cents (defaults in `.env.example`):**

- `INTAKE_TIER_STANDARD_CENTS=99900`
- `INTAKE_TIER_AI_PREMIUM_CENTS=199900`
- `WIDGET_SUBSCRIPTION_*`, `SITE_MAINTENANCE_*`

**Optional but useful:**

| Variable | When needed |
|----------|-------------|
| `RESEND_API_KEY` + `INTAKE_FROM_EMAIL` | Intake / launch emails |
| `TURNSTILE_*` | Production-like `/get-started`; **omit locally** → captcha bypassed in dev |
| `OPENAI_API_KEY`, `GEMINI_API_KEY` | AI Premium image studio + auto provision |
| `CRON_SECRET` | Run provision worker locally |
| Admin user | `profiles.is_admin = true` in Supabase |

### 2. Database

```bash
bash scripts/db-migrate.sh
```

Confirms migrations through `20260604120000_intake_launch_payments.sql` (launch payment columns).

### 3. Stripe catalog (one-time per test account)

**Only run if** `npm run stripe:verify` fails or `STRIPE_PRICE_*` are empty:

```bash
npm run stripe:catalog    # idempotent; uses sk_test from .env.local
npm run stripe:verify     # all ✓
```

You do **not** need to re-run catalog after every code change—only when IDs are missing or you changed cent env vars and need new prices.

### 4. Three terminals (recommended)

| Terminal | Command |
|----------|---------|
| **A — App** | `npm run dev` → http://localhost:3000 |
| **B — Stripe webhooks** | `stripe listen --forward-to localhost:3000/api/webhooks/stripe` |
| **C — Cron / curl** | Provision jobs (see below) |

When `stripe listen` starts, copy the **`whsec_...`** signing secret into `.env.local` as `STRIPE_WEBHOOK_SECRET`, then **restart** `npm run dev` so checkout webhooks are accepted.

**Stripe test card:** `4242 4242 4242 4242`, any future expiry, any CVC.

---

## Quick sanity checks (before scenarios)

1. **Landing** — http://localhost:3000 → pricing matches env ($99 Pro, $999 Standard, $1,999 Premium, $149 maintenance).
2. **Stripe health** — Log in as admin → open `/api/admin/stripe-health` (JSON, all prices active).
3. **Webhook** — Complete one checkout; Terminal B shows `checkout.session.completed`; `/admin/stripe-events` shows the event processed.

---

## Scenario 1 — Widget: 30-day trial (no Stripe)

**Goal:** Self-serve signup without payment.

1. Open http://localhost:3000/signup
2. Create account with a **new** test email.
3. Expect redirect to `/dashboard` (not Stripe).
4. In Supabase `contractor_settings`: `subscription_status` = `trialing`, `trial_ends_at` in the future.

**Pass:** No Stripe session; dashboard loads.

**If you land on `/billing?reason=trial_expired` instead:** You were already logged in with an ended trial, or signup did not create `contractor_settings` (fixed by migration `20260605120000_signup_contractor_trial`). Log out on `/signup`, use a new email, or run `bash scripts/db-migrate.sh` and retry.

---

## Scenario 2 — Widget: skip trial (Pro subscription)

**Goal:** Immediate Pro checkout + webhook updates contractor.

1. Ensure Terminal B is listening and `STRIPE_WEBHOOK_SECRET` matches.
2. Open http://localhost:3000/signup?subscribe=1&plan=monthly
3. Sign up → redirect to `/billing?checkout=1&plan=monthly` → Stripe Checkout.
4. Pay with test card → return to billing/dashboard.
5. Check `/admin/stripe-events` — `checkout.session.completed` processed.
6. `contractor_settings`: `subscription_status` = `active`, `stripe_subscription_id` set.

**Pass:** Webhook 200; subscription active.

Repeat with `plan=yearly` if you want yearly Pro verified.

---

## Scenario 3 — Get-started: widget path (P0 funnel)

**Goal:** “Has website” must **not** create a site-build intake.

1. Open http://localhost:3000/get-started
2. Check **“I already have a website”**.
3. Expect redirect to `/signup?from=get-started` (no email sent).
4. Optional API check:

```bash
curl -s -X POST http://localhost:3000/api/intake/public/start \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","hasWebsite":true,"turnstileToken":"dev-bypass"}' | jq
```

Expect `400` with message pointing to `/signup`.

**Pass:** No new `prospect_intakes` row with `requested_product: widget` from this flow.

---

## Scenario 4 — Full site intake (Standard)

**Goal:** Email → verify → tier → submit → admin approval → $999 checkout → optional maintenance.

### 4a — Start intake (public)

**Option A — With Resend:** http://localhost:3000/get-started?tier=standard → submit email → open link in inbox.

**Option B — Without Resend (faster):**

1. Log in as admin → http://localhost:3000/admin/intakes
2. **Generate intake link** (leave email blank or fill it) → copy URL (e.g. `/intake/abc123...?tier=standard`).
3. Admin-created links skip public email verify when opened directly.

**Option B2 — Public path without Resend:**

1. Submit get-started form.
2. In Supabase `prospect_intakes`, copy `token` for your email.
3. Verify: `http://localhost:3000/api/intake/public/verify?token=<TOKEN>`
4. Open `http://localhost:3000/intake/<TOKEN>?tier=standard`

### 4b — Intake form

1. Confirm **Standard** tier selected (URL `?tier=standard` pre-selects via PATCH).
2. Toggle **monthly/yearly** maintenance — saved on tier API as `maintenance_plan`.
3. Fill required fields → **Submit**.
4. Thank-you page shows **Launch payments** with “Awaiting preview approval” (no pay button yet).

### 4c — Admin: unlock build payment

1. http://localhost:3000/admin/intakes → **Details** on the intake.
2. Click **Mark preview approved & email pay link** (email only if `RESEND_API_KEY` set).
3. Reopen intake URL (or `/intake/<TOKEN>?pay=standard_build` for auto-redirect to Stripe).
4. **Launch payments** → **Pay $999** → Stripe test card.
5. Webhook: `intake_standard_build` → `build_paid_at` set; `intake_payments` row `kind=standard_build`.

### 4d — Provision + maintenance (optional full path)

1. **Build site** from admin onboarding (or trigger cron):

```bash
curl -s "http://localhost:3000/api/cron/process-provision-jobs" \
  -H "Authorization: Bearer $CRON_SECRET"
```

2. Intake gets `provisioned_contractor_id` when provision completes.
3. Admin intake detail → **Mark site live**.
4. Customer intake → **Start site maintenance** (subscription checkout).
5. Webhook: `intake_maintenance` → contractor `subscription_status=active`, `maintenance_started_at` on intake.

**Pass:** Payment stages move draft → awaiting preview → standard_build → (after live) maintenance → complete.

---

## Scenario 5 — AI Premium intake (deposit + balance)

**Goal:** Deposit unlocks studio; balance only after preview approval.

### 5a — Start

- http://localhost:3000/get-started?tier=ai_premium  
  or admin-generated link with `?tier=ai_premium`

### 5b — Deposit

1. Select **AI Premium** (auto-redirects to Stripe for deposit if not paid).
2. Pay **~$600** (30% of $1,999) on Stripe.
3. Return `?payment=success` → deposit banner green; image studio unlocked (needs `OPENAI_API_KEY` to generate).
4. DB: `deposit_status=paid`, `intake_payments.kind=deposit`.

### 5c — Submit + balance

1. Complete form / studio (or minimal submit if testing payments only).
2. Admin → **Mark preview approved**.
3. Intake → **Pay $1,399** (or `?pay=balance`).
4. Webhook: `intake_balance` → `balance_paid_at`.

### 5d — Refund deposit (admin)

On `/admin/intakes/[id]` with paid deposit → **Refund AI Premium deposit** → Stripe refund + `deposit_status=refunded`.

**Pass:** Deposit and balance webhooks idempotent; refund clears paid deposit state.

---

## Scenario 6 — Landing ↔ intake price parity

1. http://localhost:3000/#pricing — note Pro / Standard / Premium / maintenance toggle.
2. Same numbers on http://localhost:3000/intake/<any-draft-token> tier cards.

**Pass:** All driven by same env cents (and `next.config` passthrough for landing).

---

## Scenario 7 — Multi-service intake + Other + presentation

1. Open a draft intake URL (Standard or AI Premium).
2. Under **Services & pricing**, select multiple groups (e.g. **Garages & Garage Storage** + **Pantries & Wine Storage**).
3. Check **Other**, enter `Wine cellars` (1–120 chars), submit (or generate AI brief on Premium after deposit).
4. **Pass (submit):** `prospect_intakes.other_services` set; `services` includes `Other (describe below)`.
5. **Pass (auto template provision):** Site theme skews garage/pantry/wine pool (e.g. `garage-industrial`, `wine-cellar`); `site_configs.layout_style` is not always `standard`.
6. **Pass (AI Premium):** Generate brief → `ai_site_config.presentation` present with `theme` + `layoutStyle`.

Requires migration `20260606120000_intake_other_services.sql` (`bash scripts/db-migrate.sh`).

---

## Scenario 8 — Admin visibility

1. http://localhost:3000/admin/intakes
2. Columns: **Tier**, **Deposit**, **Payment due** (e.g. “Deposit due”, “Build payment due”, “Awaiting preview approval”).
3. **Details** → actions + payment timeline.

**Pass:** Payment due label matches customer intake **Launch payments** block.

---

## Scenario 9 — Stripe verify + catalog drift

```bash
npm run stripe:verify
```

Fix any ✗ before debugging checkout failures.

Common issues:

| Symptom | Fix |
|---------|-----|
| Webhook 400 signature | Update `STRIPE_WEBHOOK_SECRET` from current `stripe listen` session; restart dev |
| Checkout uses `price_data` not catalog ID | Amount mismatch vs env; re-run `stripe:catalog` or align `INTAKE_*_CENTS` |
| Return URL wrong host | Single `NEXT_PUBLIC_SITE_URL=http://localhost:3000` |
| Skip-trial not activating | Webhook not forwarded; check Terminal B |
| Pay button missing | `preview_approved_at` null — use admin approve |
| Maintenance checkout blocked | `site_live_at` null and/or no `provisioned_contractor_id` |
| get-started 400 captcha | Set Turnstile keys or rely on dev bypass (`NODE_ENV=development`, no `TURNSTILE_SECRET_KEY`) |

---

## Suggested test order (one sitting)

1. `npm run stripe:verify`
2. Start dev + `stripe listen` (+ update webhook secret)
3. Scenario 2 (skip trial) — confirms webhooks + Pro
4. Scenario 3 (widget redirect)
5. Scenario 5a–5c (Premium deposit + balance) — highest value
6. Scenario 4 (Standard build + optional maintenance)
7. Scenario 1 (trial) — quick regression

---

## Production

Do **not** use this doc for live keys. Follow [STRIPE_PRODUCTION.md](./STRIPE_PRODUCTION.md) and [BILLING_RUNBOOK.md](./BILLING_RUNBOOK.md).

---

## Related docs

- [GO_LIVE_PRICING_FUNNEL_PLAN.md](../GO_LIVE_PRICING_FUNNEL_PLAN.md) — architecture and sprint scope
- [BILLING_RUNBOOK.md](./BILLING_RUNBOOK.md) — ops when automation is not enough
