# Graphile Worker (Full redesign + surgical + long AI jobs)

Long AI work (Full redesign, **surgical edits**, provision, intake generate,
admin images) runs on an always-on **Graphile Worker** process. Supabase
Postgres is the queue; **Render** Background Worker is the default host. Vercel
only enqueues jobs and serves the admin/intake poll APIs.

## Why

Vercel serverless `maxDuration` (even 800s) kills Full redesign mid-Claude —
and site-wide surgical renames also exceeded the 60s API budget (504).
Heartbeats cannot revive a dead isolate. Graphile has no execution time limit.

## Architecture

1. Next API writes UI status (`custom_build_job` or `background_job`) and calls
   `enqueueJob(taskId, payload)` → `graphile_worker.add_job`.
2. Render worker `LISTEN`s on Postgres and runs the task.
3. Admin / intake UI polls existing JSON columns — no streaming required.

### Task IDs

| Task | Enqueued from | Status column |
|---|---|---|
| `full_redesign` | `/api/admin/sites/[id]/custom-build` (`intent: full` **or** `surgical`), and `startAutoLaunchRedesign` for the automatic first redesign | `site_configs.custom_build_job` |
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

Production gate: `GET /api/health/graphile` returns **503** in production when
`DATABASE_URL` is missing or unreachable (use as a Vercel healthcheck).

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
4. Instance type: prefer **Standard ≥2GB** (512MB OOMs Claude). Starter ($7/mo) is the minimum plan — Background Workers have no Free tier.
5. Set every env key in the checklist below (same secrets the Next app uses for AI + Supabase).
6. Deploy. Logs should show: `connected — listening for jobs`

Concurrency is **1** on small Render instances so two Full redesigns do not OOM.

### Render env checklist

Kept in sync with `worker/render.yaml` via CI (`npm run check:render-env`).

<!-- render-env-checklist -->
```
- DATABASE_URL
- NEXT_PUBLIC_SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- ANTHROPIC_API_KEY
- GEMINI_API_KEY
- OPENAI_API_KEY
- CUSTOM_SITE_CLAUDE_MODEL
```

## Full redesign multi-pass + resume

Full redesign no longer asks the model for every page in one JSON blob.

1. **Foundation** — `globalCss` + home `/` (locked brief + `serviceUpdates` stored on the job)
2. **One page per pass** — remaining intake paths, matching chrome from home
3. After each pass, draft is written to `site_configs.custom_config_draft` and
   `custom_build_job` gets `pass` / `passes_done` / `required_paths` for the UI

Resume:

- Worker OOM / crash mid-run → status stays `processing`; next claim resumes
  remaining empty paths from the draft checkpoint (locked brief reused).
- Soft model failure → status `failed`, Graphile retries (max 3) **reopen** the
  same `started_at` and continue from checkpoint (cancel messages are skipped).
- After max attempts / stale expire → `dead_lettered: true`. **Re-queue** keeps
  the draft and resumes remaining pages.
- Admin clicks **Full redesign** → new `started_at`, **draft cleared**, fresh
  multipass (does not resume yesterday’s half site).

Prefer **≥2GB** RAM on Render — 512MB OOMs Claude mid-foundation.

## Surgical edits (also Graphile)

**Edit surgically** uses the same `full_redesign` Graphile task with
`custom_build_job.intent = 'surgical'`:

- Draft is **not** cleared on enqueue (patch applies onto the current draft).
- One model call (plus deterministic hero/video shortcuts inside the worker).
- **Model chain (surgical only):** Gemini (`gemini-pro-latest` / `CUSTOM_SITE_GEMINI_MODEL`) → OpenAI (`gpt-4.1` / `CUSTOM_SITE_OPENAI_MODEL`) → Anthropic (`claude-sonnet-5`). Falls through on credit or API failures.
- **Contact shortcuts:** phone / email / address “change everywhere … to …” runs as deterministic string replace (plus `seo_config` sync). Does not trust the model — empty patches that claim success are rejected.
- **CSS integrity:** truncated `globalCss` replacements are rejected/appended; use `globalCssAppend` for additive rules. Admin **Restore CSS from published** recovers a wiped draft stylesheet.
- Admin UI polls the same job panel; Preview stays available while surgical runs.
- Site-wide renames that used to 504 on Vercel now finish on Render.

## Auto-launch (first redesign, no admin)

A submitted intake now reaches a live bespoke site with **zero admin clicks**
(`src/lib/launch/autoLaunch.ts`). After `provisionTenant` finishes,
`startAutoLaunchRedesign` enqueues one `full_redesign` job carrying
`custom_build_job.auto_launch = true`. When that job succeeds the worker calls
`finishAutoLaunch` → `publishCustomSiteDraft` → `autoApproveTenantSite`.

Deliberately **redesign-first, reveal-second**: the tenant stays gated at
`pending_approval` while the redesign runs, so the public never sees the engine
template. Neither gate is bypassed — the publish quality/uniqueness gate still
blocks a bad draft, and `syncTenantLaunchAccess` still enforces launch payment
(paid → `active`, unpaid → `awaiting_launch_payment` + pay link).

- Idempotency lives on the row, not in the job JSON:
  `site_configs.auto_launch_redesign_at` (enqueued once) and
  `auto_launch_completed_at` (publish + approve ran once).
- Terminal failure (Graphile attempts exhausted) → `failAutoLaunch` still
  reveals the site on the engine template so a paying customer is not stranded.
  Set `AUTO_LAUNCH_REVEAL_ON_REDESIGN_FAILURE=false` to keep it gated instead.
- Kill switch: `AUTO_LAUNCH_REDESIGN=false` restores the fully manual flow.
- Audit rows are written with a **null `actor_id`** and
  `actor_email = 'system:auto-launch'` — that is how you tell platform actions
  from human ones in `admin_audit_log`.
- Every auto site enters the `custom_design_fingerprints` uniqueness registry,
  so expect more publishes held for admin review as volume grows.
- Worker `concurrency` is **1** across all task types: each new intake now adds
  a multi-minute redesign to that single lane.

## Admin UX + observability

- Site Custom Build panel: Queued → Processing → current pass, heartbeat age,
  classified errors (worker offline / OOM / incomplete pages), Preview gated
  while running or incomplete.
- `/admin/background-jobs` — `graphile_worker.jobs` + recent `custom_build_job`
  rows, SLO highlights, one-click Re-queue.
- Render logs: JSON events `full_redesign_start|done|failed` with job id,
  attempt, durationMs, pageCount, htmlSizes. Auto-launch adds
  `auto_launch_queued|finished|approved|failed_revealed` (and
  `auto_launch_finish_error` / `auto_launch_fail_handler_error` when the
  post-run hook itself throws).
- Cron `/api/cron/process-custom-build-jobs` re-enqueues orphaned queued jobs and
  emits `[ALERT custom-build]` for queued &gt;2m or stale heartbeat (≥5m silence).
  On Vercel Hobby this runs **once daily** (`5 5 * * *`); Graphile Worker still
  claims jobs immediately when enqueued, and the admin status poll also re-kicks
  orphaned `queued` jobs.

## Ops / recovery

- Daily cron `/api/cron/process-custom-build-jobs` **re-enqueues** orphaned
  `custom_build_job.status = queued` rows (worker was offline). It does **not**
  run AI work on Vercel.
- `/api/internal/process-custom-build` is deprecated (410).
- Stale Full redesign window: ~45 minutes without heartbeat → dead-lettered.

## Success check

1. Admin → Full redesign on a tenant.
2. Render logs show `full_redesign_start` … checkpoint JSON … `full_redesign_done`
   (or `full_redesign_reopen` after a retry).
3. Admin panel shows pass progress (`foundation:/`, `/about`, …) then `succeeded`.
4. `/api/health/graphile` returns `{ ok: true, graphile: true }`.
