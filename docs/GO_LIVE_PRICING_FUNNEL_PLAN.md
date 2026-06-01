# Go-live plan: pricing, funnel, and Stripe (P0 → P2)

End-to-end plan to fix funnel misrouting, production Stripe catalog, automated
collections for all offerings, and ops runbooks. Pricing below is the **recommended
locked model** (matches current landing, env defaults, and Stripe catalog).

---

## Locked pricing (sensible defaults)

| Offering | One-time | Recurring (after launch) | Day-1 Stripe |
|----------|----------|---------------------------|--------------|
| **ClosetQuote Pro** (has a site) | — | $99/mo or $990/yr (2 mo free) | Subscription checkout |
| **Standard site build** | $999 | $149/mo or $1,490/yr maintenance* | Build + maintenance checkout |
| **AI Premium site build** | $1,999 total | Same maintenance* | $600 deposit† + balance + maintenance |

\* Maintenance includes ClosetQuote Pro + managed hosting (state clearly on cards).  
† Deposit = 30% of $1,999 → **$599.70** (UI shows **$600**); balance **$1,399.30** (UI **$1,399**).

**Env (cents)** — keep in Vercel + `.env.example`:

```bash
INTAKE_TIER_STANDARD_CENTS=99900
INTAKE_TIER_AI_PREMIUM_CENTS=199900
WIDGET_SUBSCRIPTION_MONTHLY_CENTS=9900
WIDGET_SUBSCRIPTION_YEARLY_CENTS=99000
SITE_MAINTENANCE_MONTHLY_CENTS=14900
SITE_MAINTENANCE_YEARLY_CENTS=149000
```

**Stripe lookup keys** (from `npm run stripe:catalog`): `cq_pro_*`, `cq_standard_build_onetime`, `cq_ai_premium_*`, `cq_site_maintenance_*`.

No price changes required for go-live; optional later test: **$1,299 Standard** promo for first 10 customers (separate coupon in Stripe, not env).

---

## Architecture target

```mermaid
flowchart TB
  subgraph widget [Widget lane - self serve]
    H1[Hero / Pricing Pro] --> SIGN[/signup]
    SIGN --> TRIAL[30-day trial - no card]
    SIGN --> SKIP[subscribe=1 → Stripe Pro]
    TRIAL --> DASH[/dashboard]
    SKIP --> DASH
  end

  subgraph site [Site build lane]
    H2[Pricing Standard / Premium] --> GS[/get-started?tier=]
    GS -->|hasWebsite=false| EMAIL[Intake email link]
    GS -->|hasWebsite=true| SIGN
    EMAIL --> INT[/intake/token]
    INT --> TIER{Tier}
    TIER -->|standard| FORM[Form + studio gates]
    TIER -->|premium| DEP[Stripe deposit]
    DEP --> FORM
    FORM --> SUBMIT[Submit → provision]
  end

  subgraph post [Post-build revenue]
    SUBMIT --> PREVIEW[Preview / QA]
    PREVIEW -->|standard| PAY999[Stripe Standard build]
    PREVIEW -->|premium| PAYBAL[Stripe balance]
    PAY999 --> LAUNCH[Launch + keys]
    PAYBAL --> LAUNCH
    LAUNCH --> MAINT[Stripe site maintenance sub]
  end
```

---

## Phase 0 — Must ship before marketing spend (P0)

**Goal:** Correct routing, production Stripe IDs, no duplicate products.

### P0.1 — Funnel: widget vs site build

| Task | Change |
|------|--------|
| **get-started** | If “I already have a website” → redirect to `/signup` (or `/signup?from=get-started`) with short copy: widget is self-serve; do **not** create widget intake or send site-build email. |
| **get-started** | If unchecked → keep email intake for **full site** (`requested_product: full`). |
| **public/start API** | Reject or no-op `hasWebsite: true` with message pointing to `/signup` (defense if UI bypassed). |

**Files:** `src/app/get-started/page.tsx`, `src/app/api/intake/public/start/route.ts`

### P0.2 — Production Stripe + env

| Task | Change |
|------|--------|
| Run `npm run stripe:catalog` with **live** `STRIPE_SECRET_KEY` | Creates mirror of test catalog |
| Set all `STRIPE_PRICE_*` on **Vercel production** | Match script output |
| Set all `INTAKE_*`, `WIDGET_*`, `SITE_MAINTENANCE_*` | Same as `.env.example` |
| Single `NEXT_PUBLIC_SITE_URL` | `https://www.closetquotes.com` (remove duplicate localhost in prod) |
| Webhook | Live endpoint `https://www.closetquotes.com/api/webhooks/stripe` + live `STRIPE_WEBHOOK_SECRET` |
| Archive duplicate product | Stripe Dashboard → archive **May 21** “ClosetQuote Pro”; keep **Jun 1** `cq_pro` product |

**Verify:** `npm run stripe:verify` against live env locally; `GET /api/admin/stripe-health` in prod.

### P0.3 — Smoke tests (P0 exit criteria)

- [ ] Trial signup → dashboard, no Stripe
- [ ] Skip trial → Stripe Pro → webhook → `active`
- [ ] get-started + has website → lands on signup, no intake email
- [ ] get-started full site → intake email → premium tier → deposit checkout → paid → studio unlocks
- [ ] Landing prices match intake prices (env-driven)

**Estimate:** 0.5–1 day eng + 0.5 day ops (Stripe/Vercel).

---

## Phase 1 — Conversion clarity + ops (P1)

**Goal:** Site buyers find the right path; money collection beyond deposit is defined.

### P1.1 — Landing / hero

| Task | Change |
|------|--------|
| Hero secondary CTA | “Need a full site? From $999” → `/#pricing` |
| Pricing toggle hint | Under monthly/yearly: “Applies to Pro subscription and site maintenance. Build fees are one-time.” |
| Site-build cards | Explicit: “Maintenance includes ClosetQuote Pro — no separate $99 widget fee.” |
| Nav “Start Free” | Keep; optional dropdown later: Trial / Get a site |

**Files:** `src/app/page.tsx`

### P1.2 — Ops runbooks (docs)

Create `docs/ops/BILLING_RUNBOOK.md`:

1. **Premium deposit refund** (not satisfied): Stripe Dashboard refund on session; set intake `deposit_status` + audit log; template email.
2. **Premium balance ($1,399)**: Until P2 automated — Payment Link or Checkout with `STRIPE_PRICE_AI_PREMIUM_BALANCE`.
3. **Standard $999** (satisfied): Same — `STRIPE_PRICE_STANDARD_BUILD` Payment Link.
4. **Maintenance start**: Payment Link `STRIPE_PRICE_SITE_MAINTENANCE_*` or P2 flow; tie to `stripe_customer_id` on contractor after provision.
5. **Escalation**: admin@closetquotes.com, link to `/admin/intakes`, `/admin/stripe-events`.

### P1.3 — Admin visibility

| Task | Change |
|------|--------|
| Admin intakes list | Columns: tier, deposit, **payment due** (balance / standard / maintenance), link “Send payment link” (P2) |
| Optional status | `awaiting_build_payment`, `awaiting_balance`, `awaiting_maintenance` on intake or contractor |

**Files:** `src/app/admin/intakes/page.tsx`, optional migration for `payment_stage` enum.

**Estimate:** 1 day eng + 0.5 day docs/process.

---

## Phase 2 — Full Stripe wiring (P2)

**Goal:** All catalog prices collectible in-app without manual Dashboard links.

### P2.1 — Intake checkout kinds (extend `/api/intake/[token]/checkout`)

Single route, `POST` body `{ kind: 'deposit' | 'balance' | 'standard_build' }`:

| kind | When | Price ID | Gates |
|------|------|----------|-------|
| `deposit` | AI Premium, draft | `STRIPE_PRICE_AI_PREMIUM_DEPOSIT` | tier = ai_premium, not paid |
| `balance` | Before launch, satisfied | `STRIPE_PRICE_AI_PREMIUM_BALANCE` | tier = ai_premium, deposit paid, status `awaiting_balance` |
| `standard_build` | Before launch, satisfied | `STRIPE_PRICE_STANDARD_BUILD` | tier = standard, status `awaiting_build_payment` |

Webhook `checkout.session.completed` metadata `kind`:

- `intake_deposit` (existing)
- `intake_balance` → record `intake_payments`, set `build_balance_paid_at` or flag
- `intake_standard_build` → record payment, set `build_paid_at`

**Files:** `src/app/api/intake/[token]/checkout/route.ts`, `src/app/api/webhooks/stripe/route.ts`, migration for payment flags.

### P2.2 — Customer payment pages

| Surface | Purpose |
|---------|---------|
| **Intake “Pay to launch” block** | After submit + preview ready (or admin marks “ready for payment”) — buttons: Pay $999 / Pay $1,399 |
| **Email template** | “Your site is ready — pay to launch” with magic link `/intake/[token]?pay=balance` |

Admin action: **Mark preview approved** → triggers email + unlocks pay CTA (manual QA gate).

### P2.3 — Site maintenance subscription

| Task | Change |
|------|--------|
| New route `POST /api/intake/[token]/checkout-maintenance` or extend checkout with `kind: 'maintenance'` | `mode: subscription`, prices `STRIPE_PRICE_SITE_MAINTENANCE_*`, `customer_email` from intake |
| On success webhook | Link subscription to **contractor** when provision creates `contractor_settings` (store `stripe_subscription_id` + `subscription_plan`) |
| Policy | First maintenance invoice **after launch** (admin clicks “Site live” → send maintenance checkout email) |

Alternative: attach maintenance at **provision complete** if intake included `maintenance_plan: monthly|yearly` on form (add field).

**Files:** checkout route, webhook, `provisionTenant.ts`, intake form optional maintenance plan picker.

### P2.4 — Deposit refund automation (optional P2.5)

| Task | Change |
|------|--------|
| Admin button “Refund deposit” | Stripe refund API + update intake + `intake_payments.status=refunded` |

**Files:** `src/app/admin/intakes/[id]/actions.ts` (new).

### P2.5 — Deep links (P2 from earlier list)

| Task | Change |
|------|--------|
| Landing | `/get-started?tier=standard` / `?tier=ai_premium` |
| Intake page | Server-read `searchParams.tier` → pre-select tier on load (PATCH tier once) |
| Pricing CTAs | `href="/get-started?tier=standard"` and `?tier=ai_premium` |

**Files:** `src/app/get-started/page.tsx`, `src/app/intake/[token]/page.tsx`, `IntakeFormClient.tsx`, `page.tsx` pricing links.

### P2.6 — Webhook + idempotency hardening

- Handle `checkout.session.completed` for all `kind` values
- `customer.subscription.created` for maintenance → update contractor (reuse `syncSubscription`)
- Tests: webhook fixture tests or manual Stripe CLI

**Estimate:** 3–5 days eng (checkout + webhook + admin + intake UI + provision link).

---

## Implementation order (recommended sprints)

| Sprint | Scope | Outcome |
|--------|--------|---------|
| **Sprint A** | P0 only | Safe to drive traffic; widget + premium deposit work |
| **Sprint B** | P1 | Clear positioning; manual Payment Links documented |
| **Sprint C** | P2.1–2.3 | Standard/balance/maintenance checkout automated |
| **Sprint D** | P2.4–2.6 | Refunds, deep links, polish |

---

## Database additions (P2 migration sketch)

```sql
-- prospect_intakes
ALTER TABLE prospect_intakes
  ADD COLUMN IF NOT EXISTS build_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS balance_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS maintenance_plan text, -- 'monthly' | 'yearly' | null
  ADD COLUMN IF NOT EXISTS preview_approved_at timestamptz;

-- intake_payments.kind check: deposit | balance | standard_build
```

---

## GTM alignment (day one)

| Channel | Primary offer | CTA |
|---------|---------------|-----|
| Cold email / ads (has site) | 30-day trial | Hero → signup |
| Cold email (no site) | Standard $999 or Premium | `#pricing` → get-started |
| Sales call | AI Premium + deposit | Send intake link `?tier=ai_premium` |
| Partner / scraper | Match pipeline A → signup, B → full intake | Existing `pipelineToRequestedProduct` |

---

## Success metrics (first 30 days)

| Metric | Target |
|--------|--------|
| Trial signups | Track weekly |
| Trial → paid Pro | >15% within 45 days of trial end |
| Intake starts (full site) | Track funnel drop email → open → tier |
| Premium deposits | Count + $; refund rate <10% |
| Standard/Premium launch payments | After P2: time from preview approval → paid <7 days |
| Maintenance attached | % of launched sites with active maintenance sub within 14 days of launch |

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Standard builds without deposit consume labor | Admin “preview approved” gate before build complete; contract TOs |
| Maintenance not sold at launch | P2 maintenance email mandatory in launch checklist |
| Env/Stripe drift | `stripe:verify` in CI; admin stripe-health |
| Duplicate Pro product | Archive old; env points to `cq_pro` prices only |
| get-started confusion | P0 split widget → signup |

---

## Checklist summary

### P0
- [ ] get-started widget → `/signup`
- [ ] Live Stripe catalog + Vercel env
- [ ] Archive duplicate Pro product
- [ ] P0 smoke tests

### P1
- [ ] Hero + pricing copy
- [ ] `docs/ops/BILLING_RUNBOOK.md`
- [ ] Admin intake payment visibility

### P2
- [ ] Checkout kinds: balance, standard_build, maintenance
- [ ] Webhook handlers + DB flags
- [ ] Intake/admin “pay to launch” UI
- [ ] Maintenance sub linked at launch
- [ ] `?tier=` deep links
- [ ] Optional admin refund button

---

*Last updated: plan authored for closet-dashboard go-live. Implement sprints A→D in order.*
