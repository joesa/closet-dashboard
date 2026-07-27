# Graphile Worker (Full redesign + long AI jobs)

Long AI work (Full redesign, provision, intake generate, admin images) runs on
an always-on **Graphile Worker** process. Supabase Postgres is the queue;
**Render** Background Worker is the default host. Vercel only enqueues jobs and
serves the admin/intake poll APIs.

## Why

Vercel serverless `maxDuration` (even 800s) kills Full redesign mid-Claude.
Heartbeats cannot revive a dead isolate. Graphile has no execution time limit.

## Architecture

1. Next API writes UI status (`custom_build_job` or `background_job`) and calls
   `enqueueJob(taskId, payload)` → `graphile_worker.add_job`.
2. Render worker `LISTEN`s on Postgres and runs the task.
3. Admin / intake UI polls existing JSON columns — no streaming required.

### Task IDs

| Task | Enqueued from | Status column |
|---|---|---|
| `full_redesign` | `/api/admin/sites/[id]/custom-build` | `site_configs.custom_build_job` |
| `provision_tenant` | `kickProvisionAfterSubmit` | `provision_jobs` |
| `intake_generate_site` | `/api/intake/[token]/generate-site` | `prospect_intakes.background_job` |
| `intake_generate_images` | `/api/intake/[token]/generate-images` | `prospect_intakes.background_job` |
| `admin_generate_images` | `/api/ai/generate-images` (with `tenantId`) | `site_configs.background_job` |
| `admin_generate_before` | `/api/ai/generate-before` | `site_configs.background_job` |

## DATABASE_URL (critical)

Use a **session-mode** Postgres URI (port **5432**):

- Direct: `postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres`
- Session pooler: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres`

Append `?sslmode=require`. Do **not** use the transaction pooler (`:6543`) —
`LISTEN/NOTIFY` breaks.

Set the same `DATABASE_URL` on:

- **Vercel** (dashboard) — so API routes can `add_job`
- **Render** (worker) — so the runner can claim jobs
- Local `.env.local` — so `npm run worker` / enqueue work in dev

`bash scripts/db-migrate.sh` will derive a session URI from the linked Supabase
pooler URL + `SUPABASE_DB_PASSWORD` when `DATABASE_URL` is unset.

## Schema migrate

After the `background_job` SQL migration is applied:

```bash
# From closet-dashboard, with DATABASE_URL in .env.local
bash scripts/db-migrate.sh   # also runs worker:migrate when DATABASE_URL is set
# or:
npm run worker:migrate
```

Prefer applying schema via migrate (owner role) before the first worker boot.
Worker boot also calls Graphile migrate as a safety net.

## Local development

```bash
# Terminal A — Next app
npm run dev

# Terminal B — worker (same .env.local)
npm run worker
```

Or Docker:

```bash
docker compose -f docker-compose.worker.yml up --build
```

Without `DATABASE_URL`, intake/admin image routes fall back to sync HTTP
(Vercel-style timeouts still apply). Full redesign **requires** `DATABASE_URL`.

## Render deploy

1. Create a **Background Worker** on Render (or apply `worker/render.yaml`).
2. **Root Directory**: closet-dashboard repo root (not `worker/`).
3. Build: `npm ci` — Start: `npm run worker`
   (`tsx` / `dotenv` are production dependencies so they install under `NODE_ENV=production`.)
4. Instance type: **Starter** ($7/mo) — Background Workers have no Free tier.
   - `DATABASE_URL` (session 5432)
   - `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`
   - any other secrets tasks import (storage, etc.)
5. Deploy. Logs should show: `connected — listening for jobs`

Concurrency is **1** on free Render so two Full redesigns do not OOM.

## Ops / recovery

- Minutely cron `/api/cron/process-custom-build-jobs` **re-enqueues** orphaned
  `custom_build_job.status = queued` rows (worker was offline). It does **not**
  run AI work on Vercel.
- `/api/internal/process-custom-build` is deprecated (410).
- Stale Full redesign window: ~45 minutes without heartbeat.

## Success check

1. Admin → Full redesign on a tenant.
2. Render logs show `full_redesign start` … Claude … images … `done`.
3. Admin panel polls `custom_build_job` to `succeeded` without a ~5 minute fail.
