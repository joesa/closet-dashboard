# Closet Dashboard

The control plane for DitchTheForm. A Next.js 16 (App Router) + Supabase app that
serves the widget backend APIs, contractor/admin dashboards, Stripe billing, AI
site generation, and the outbound (Instantly + Twilio) automation surface.

## What lives here

- **Widget backend APIs** — the embeddable [closet-widget](../closet-widget)
  calls these:
  - `POST /api/settings` — pricing + branding for a `contractorId` (a.k.a.
    `widget_id`).
  - `POST /api/calculate` — tiered price estimate (rooms, linear feet, finish,
    add-ons).
  - `POST /api/send-lead` — captures a lead, emails the contractor (Resend), and
    optionally SMS-notifies them (Twilio).
- **Billing** — Stripe Checkout, customer portal, and webhook-driven
  entitlement gating.
- **Admin** — contractor management, subscriptions, Stripe event inspection,
  site approve/delete, and a "run scraper" trigger.
- **AI site generation** — `/api/ai/generate-site` and
  `/api/ai/generate-sitemap` (Google Gemini) used to bootstrap tenant marketing
  sites for [custom-closets-websites](../custom-closets-websites).
- **Sandbox provisioning** — `/api/sandbox/provision` creates a tenant +
  `contractor_settings` row in one step (admin manual builds).
- **Self-serve intake** — `/get-started` → email verify → `/intake/[token]` →
  async `provision_jobs` processed by `/api/cron/process-provision-jobs` (Vercel
  Cron). Full sites default to `pending_approval`; widget-only uses Pipeline A.
- **Provision ops** — `/admin/provision-jobs` for failed/needs-review retries.
- **Manual AI intercept** — set `provisioning_mode: manual` when creating an intake (or toggle on the intakes table) to skip auto template cron; use **AI build →** in onboarding after submit.
- **Outbound automation** — `/api/instantly/scraper-webhook` ingests qualified
  leads from [closet-scraper](../closet-scraper); `/api/scraper/config` and
  `/api/scraper/run-status` form the scraper control plane.

## Data model

`contractor_settings` is the pricing/billing identity (the widget's
`contractorId`). `tenants` / `domains` / `site_configs` are the site/branding
identity. `tenants.widget_id` is the bridge between them and is guaranteed to
equal `tenants.id` and reference a `contractor_settings` row. See
[`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) for the full reconciliation.

## Getting started

1. Copy the env template and fill it in:

```bash
cp .env.example .env.local
```

2. Apply Supabase migrations (so tables like `contractor_settings`, `tenants`,
   and `instantly_sync_events` exist):

```bash
supabase db push
```

3. Run the dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For full local testing of pricing, intake, and Stripe (trial, skip-trial, deposits,
pay-to-launch, maintenance), see
[`docs/ops/LOCAL_E2E_TESTING.md`](docs/ops/LOCAL_E2E_TESTING.md).

## Scripts

- `npm run dev` — Next dev server (webpack).
- `npm run build` — production build.
- `npm run start` — serve the production build.
- `npm run lint` — ESLint.
- `npm run stripe:verify` — validate Stripe env + price IDs.
- `npm run stripe:catalog` — create/update test catalog (idempotent).

## Environment

All variables are documented in [`.env.example`](.env.example), grouped by
concern: Supabase, Resend/Twilio, Stripe, demo anti-abuse, Gemini, the cron
secret, Instantly automation, and the scraper control plane. The Stripe webhook
and entitlement gate require the server-only `SUPABASE_SERVICE_ROLE_KEY`.

## Instantly scraper receiver

`/api/instantly/scraper-webhook` validates scraper webhook auth, enforces
idempotency per run/pipeline/batch, upserts Instantly campaigns from incoming
campaign metadata, imports deduped leads into the mapped campaign, and
optionally auto-starts campaigns when the warmup gate allows it. Apply Supabase
migrations so `public.instantly_sync_events` exists before enabling it in
production.

## Deploy

Deploys to Vercel. Set every variable from `.env.example` in the project's
environment, point Stripe + Twilio webhooks at the deployed routes, and add the
`CRON_SECRET`-protected demo-reset cron.
