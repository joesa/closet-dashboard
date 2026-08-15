# Graphile Worker (Full redesign + surgical + long AI jobs)

Long AI work (Full redesign, **surgical edits**, provision, intake generate,
admin images) runs on an always-on **Graphile Worker** process. Supabase
Postgres is the queue; an **always-on VM** (Docker, see Deploy below) is the
host. Vercel only enqueues jobs and serves the admin/intake poll APIs.

## Why

Vercel serverless `maxDuration` (even 800s) can kill Full redesign mid-generation —
and site-wide surgical renames also exceeded the 60s API budget (504).
Heartbeats cannot revive a dead isolate. Graphile has no execution time limit.

## Architecture

1. Next API writes UI status (`custom_build_job` or `background_job`) and calls
   `enqueueJob(taskId, payload)` → `graphile_worker.add_job`.
2. The worker process `LISTEN`s on Postgres and runs the task.
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

### Full Redesign routing policy

The automatic policy is `all-full-sites`: every newly provisioned marketing
site receives one Full Redesign regardless of intake tier. `widget_only`
tenants are excluded. `site_configs.auto_launch_redesign_at` makes the run
one-time, active-job reconciliation prevents overlap, and
`AUTO_LAUNCH_REDESIGN=false` is the emergency kill switch.

For existing sites, admins can select up to 20 tenants on `/admin/sites` and
queue a bounded batch. The endpoint skips widget-only tenants and sites with an
active custom-build job, uses the same Graphile `jobKey` idempotency as the
single-site action, and reports queued/skipped/failed status per tenant.

## DATABASE_URL (critical)

Use a **session-mode** Postgres URI (port **5432**):

- Direct: `postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres`
- Session pooler: `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres`

Append `?sslmode=require`. Do **not** use the transaction pooler (`:6543`) —
`LISTEN/NOTIFY` breaks.

Set the same `DATABASE_URL` on:

- **Vercel** (dashboard) — so API routes can `add_job`
- **Worker host** `.env.local` — so the runner can claim jobs
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

## Deploy (always-on VM)

The worker needs an always-on host with **≥2GB RAM** (512MB OOMs Claude) and no
execution time limit. Serverless cannot host it — that is the whole point of the
`## Why` section above. Any VM works; the reference host is an **Oracle Cloud
Always Free** `VM.Standard.A1.Flex` (Ampere arm64, 4 OCPU / 24GB free
indefinitely), which is why the image is built multi-arch.

Host requirements: Docker Engine + compose plugin, outbound HTTPS only. The
worker opens **no inbound ports** — it connects out to Supabase and the AI APIs,
so it needs no public IP, no reverse proxy, and no tunnel.

On a fresh VM, `worker/scripts/oracle-vm-bootstrap.sh` does the whole setup
(Docker Engine + compose plugin, clone, `.env.local` staged from the example,
Docker enabled at boot so the worker survives a reboot). It is idempotent and
stops before starting the worker, since the container is useless until real
secrets are in place:

```bash
curl -fsSL https://raw.githubusercontent.com/joesa/closet-dashboard/main/worker/scripts/oracle-vm-bootstrap.sh | bash
nano ~/closet-dashboard/.env.local          # fill in real values
cd ~/closet-dashboard
docker compose -f worker/docker-compose.prod.yml up -d --build
docker compose -f worker/docker-compose.prod.yml logs -f
```

Logs should show `[worker] starting Graphile Worker (concurrency=3)` with the
six task IDs, then `[worker] connected — listening for jobs`.

Notes:

- Build context is the **repo root**, not `worker/` — `worker/tsconfig.json`
  maps `@/*` → `../src/*`, so the tasks import out of `src/lib`.
- `tsx` / `dotenv` are production `dependencies`, so they survive the
  `NODE_ENV=production` install in the image. Keep them there.
- Only this repo is needed on the host. The `custom-closets-websites` checkout
  in CI is for the shared-lib drift check, not a runtime dependency.
- Redeploy is `git pull && docker compose -f worker/docker-compose.prod.yml up -d --build`.
  There is no deploy-on-push — that was a Render feature.

Concurrency defaults to **3**, overridable with `WORKER_CONCURRENCY`. It was
pinned to 1 only because Render's 512MB Starter box OOMed on two concurrent Full
redesigns; on a ≥2GB host the real ceiling is the **Supabase session connection
limit**, since the pool opens `WORKER_CONCURRENCY + 2` connections.

Memory is capped separately by `WORKER_MEM_LIMIT` (default **4g**), sized to be
safe on the smallest host worth using — a 1 OCPU / 6GB A1. On a 12GB instance
raise it at deploy time:

```bash
WORKER_MEM_LIMIT=8g docker compose -f worker/docker-compose.prod.yml up -d
```

That is a compose *substitution* variable, so it comes from the shell, not from
`.env.local` — that file is `env_file`, which injects into the container and is
a different mechanism. `WORKER_CONCURRENCY` does come from `.env.local`.

Measured on 2026-08-02: the Supabase instance reports `max_connections = 60`
(3 superuser-reserved) with ~22 backends already in use by the Next app. At the
default 3 the worker takes 5 of the ~35 spare, so the headroom is real but not
unlimited — re-measure before going past ~10, and remember every Vercel
serverless instance opens its own pool against the same 60.

### Capacity check

Before raising concurrency, queue exactly two non-production test tenants from
the admin batch control and follow the structured worker logs. Confirm both
emit `custom_build_start`, both finish without process restart or OOM, and the
health endpoint remains 200. Record peak container memory with:

```bash
docker stats --no-stream
docker compose -f worker/docker-compose.prod.yml logs | grep 'custom_build_\|ai_text_call'
```

Do not use live tenants for this check: successful auto-launch jobs may publish.

### Cost and latency telemetry

Every provider call emits one JSON `ai_text_call` event with `provider`,
`model`, `durationMs`, and the SDK-reported `inputTokens`, `outputTokens`, and
`totalTokens`. Full jobs separately emit `custom_build_done` or
`custom_build_failed` with end-to-end `durationMs`, page count, and HTML sizes.
Fallback failures include elapsed milliseconds in the warning log.

Cost is deliberately rate-configured rather than hard-coded because vendor and
contract pricing changes. Set both variables for each provider you use:

```bash
AI_COST_ANTHROPIC_INPUT_PER_MILLION_USD=
AI_COST_ANTHROPIC_OUTPUT_PER_MILLION_USD=
AI_COST_GEMINI_INPUT_PER_MILLION_USD=
AI_COST_GEMINI_OUTPUT_PER_MILLION_USD=
AI_COST_OPENAI_INPUT_PER_MILLION_USD=
AI_COST_OPENAI_OUTPUT_PER_MILLION_USD=
```

When both rates are valid numbers, `ai_text_call` includes
`estimatedCostUsd`; otherwise that field is omitted. Add costs for all calls
sharing the same worker job window to estimate a Full Redesign run.

### arm64 verification (done — 2026-08-02)

The Ampere host is arm64, and `sharp` is the one native dependency. It is
reached lazily (`customSiteAssets.ts` → `await import('@/lib/images/optimizeUpload')`),
so a bad binary would surface mid-redesign rather than at boot. This was checked
by building the image for `linux/arm64` and exercising it under emulation:

- `sharp` 0.35.3 / libvips 8.18.3 loads and both encodes WEBP and resizes PNG.
  `@img/sharp-linux-arm64` is already pinned in `package-lock.json`.
- `tsx` resolves the `@/*` alias at runtime, including the dynamic import above,
  and all six task modules load.
- The image boots as the unprivileged `node` user, registers all six tasks at
  `concurrency=3`, and opens a TLS session to the Supabase pooler.

So the arm64 risk is retired ahead of provisioning. What is still VM-only is
everything that needs a *running* job: crash-resume, dead-letter, `jobKey`
dedupe, three concurrent redesigns under real memory, and auto-launch.

### Worker env checklist

Kept in sync with `worker/worker.env.example` via CI (`npm run check:worker-env`).

<!-- worker-env-checklist -->
```
- DATABASE_URL
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- ANTHROPIC_API_KEY
- GEMINI_API_KEY
- OPENAI_API_KEY
- CUSTOM_SITE_CLAUDE_MODEL
- TENANT_BASE_DOMAIN
- REVALIDATE_SECRET
- RESEND_API_KEY
```

The last three were absent from this list until the first real deploy, and all
three fail *quietly* rather than loudly — worth knowing when a job "succeeds"
but the result is wrong:

| Missing | Consequence |
| --- | --- |
| `TENANT_BASE_DOMAIN` | `resolveSubdomain()` falls back to `localhost`; tenants provision onto subdomains that resolve nowhere |
| `REVALIDATE_SECRET` | published tenant sites can keep serving stale content |
| `RESEND_API_KEY` | `sendIntakeLaunchEmail()` returns early; auto-launch finishes and nobody is told |

Everything else the task path reads has a working default:
`AUTO_LAUNCH_REDESIGN` (enabled unless `'false'`), `CUSTOM_SITE_GEMINI_MODEL`,
`CUSTOM_SITE_OPENAI_MODEL`, `FULL_REDESIGN_OPENAI_MODEL`,
`FULL_REDESIGN_GEMINI_MODEL`, `PROVISION_BATCH_SIZE`, `PROVISION_MAX_ATTEMPTS`.

### Monitoring

There is no managed dashboard on a self-hosted VM. Replace it with:

- `GET /api/health/graphile` → `{ ok, graphile }`, pointed at any uptime monitor.
- `/admin/background-jobs` for queue depth and stuck jobs.
- `docker compose -f worker/docker-compose.prod.yml logs` for the JSON job events.
  Logs are capped at 5×10MB in the compose file — without that rotation they
  fill the boot volume and the worker dies with `ENOSPC`.

Note that the `[ALERT custom-build]` signals come from
`/api/cron/process-custom-build-jobs`, which `vercel.json` schedules **once
daily** on Hobby — that is not sufficient alerting for a self-hosted worker.

### Auto-deploy

There is no deploy-on-push — that was a Render feature. `worker-auto-update.timer`
replaces it by polling `origin/main` every 5 minutes:

```bash
sudo systemctl enable --now worker-auto-update.timer
systemctl list-timers worker-auto-update.timer
journalctl -u worker-auto-update.service -n 50
```

Pull-based on purpose. The security list allows no inbound port but SSH, so a
webhook would mean opening one and a GitHub Actions deploy would mean handing a
private key to a CI runner. Polling keeps every credential on the box.

It only rebuilds when something that actually ships in the image changed —
`src/`, `worker/`, `package.json`, `package-lock.json`, `.dockerignore`. A
docs-only commit fast-forwards the checkout and leaves the container alone.

It cannot interrupt work: `redeploy.sh` aborts when a job holds a lock, and
aborts *before* pulling, so the checkout is untouched and the next tick retries
the same change. An in-flight deferral is logged as normal, not as a failure.

Bootstrap installs the units but leaves the timer **disabled** — on a fresh box
`.env.local` has no secrets, and a timer firing first would start a container
that crash-loops on a missing `DATABASE_URL`. Enable it after the first good
manual deploy.

### Stale locks after a restart

A worker that dies mid-job keeps the row lock. Graphile hands that job to nobody
until the lock expires — **4 hours** by default — so it sits frozen at whatever
page it reached, next to a worker that looks perfectly healthy and idle. This is
not a crash-resume failure; resume works, it just cannot start until the lock
clears.

`stop_grace_period` is 60s, which a multi-minute Claude call will not fit
inside, so **any** recreate during a job produces this.

```sql
select id, attempts, locked_at, locked_by from graphile_worker.jobs
 where locked_at is not null;
select graphile_worker.force_unlock_workers(array['<locked_by>']);
```

The job then gets picked up within seconds and resumes from its checkpoint with
`attempts` incremented. `worker/scripts/redeploy.sh` refuses to recreate the
container while any job is locked (`FORCE=1` overrides).

### Disk

Steady-state usage is flat. The job path writes nothing to local disk —
generated images stream to Supabase Storage — and container logs are capped by
the compose `logging` block. A worker running for a year uses what it used on
day one.

Redeploys are what fill a disk. Each `up -d --build` bakes a fresh ~2GB image
and orphans the previous one, plus build cache, so on a 40–50GB boot volume
roughly a dozen rebuilds is enough to run out. Nothing reclaims it
automatically — Render did that for you.

Two defenses, both installed:

- Redeploy with **`worker/scripts/redeploy.sh`** (pull, rebuild, then prune)
  rather than calling `docker compose up --build` by hand. It prints disk
  before and after. Pruning runs *after* the new container is up, so the image
  in use is never a candidate.
- `oracle-vm-bootstrap.sh` installs a **weekly `docker-prune.timer`** as a
  backstop for manual rebuilds.

Check with `df -h /` and `docker system df`. If a build ever fails oddly or the
worker dies with `ENOSPC`, look here first — jobs stay safe in
`graphile_worker.jobs`, but nothing claims them until the box has room.

## Full redesign multi-pass + resume

Full redesign no longer asks the model for every page in one JSON blob.

**Model chain:** OpenAI (`gpt-5.6-sol` / `FULL_REDESIGN_OPENAI_MODEL`) →
Gemini (`gemini-3.1-pro-preview` / `FULL_REDESIGN_GEMINI_MODEL`) → Anthropic
(`claude-opus-5` / `FULL_REDESIGN_ANTHROPIC_MODEL`, falling back to
`CUSTOM_SITE_CLAUDE_MODEL`). Providers without API keys
are skipped; API, credit, timeout, and empty-response failures advance to the
next configured provider. This chain applies to brief creation, independent
preflight review, foundation generation, and every page pass.

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

Prefer **≥2GB** RAM on the worker host — 512MB OOMs Claude mid-foundation.

## Surgical edits (also Graphile)

**Edit surgically** uses the same `full_redesign` Graphile task with
`custom_build_job.intent = 'surgical'`:

- Draft is **not** cleared on enqueue (patch applies onto the current draft).
- One model call (plus deterministic hero/video shortcuts inside the worker).
- **Model chain (surgical only):** Gemini (`gemini-pro-latest` / `CUSTOM_SITE_GEMINI_MODEL`) → OpenAI (`gpt-4.1` / `CUSTOM_SITE_OPENAI_MODEL`) → Anthropic (`claude-sonnet-5`). Falls through on credit or API failures.
- **Contact shortcuts:** phone / email / address “change everywhere … to …” runs as deterministic string replace (plus `seo_config` sync). Does not trust the model — empty patches that claim success are rejected.
- **CSS integrity:** truncated `globalCss` replacements are rejected/appended; use `globalCssAppend` for additive rules. Admin **Restore CSS from published** recovers a wiped draft stylesheet.
- Admin UI polls the same job panel; Preview stays available while surgical runs.
- Site-wide renames that used to 504 on Vercel now finish on the worker.

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
- Worker logs (`docker compose -f worker/docker-compose.prod.yml logs`): JSON
  events `full_redesign_start|done|failed` with job id,
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
2. Worker logs show `full_redesign_start` … checkpoint JSON … `full_redesign_done`
   (or `full_redesign_reopen` after a retry).
3. Admin panel shows pass progress (`foundation:/`, `/about`, …) then `succeeded`.
4. `/api/health/graphile` returns `{ ok: true, graphile: true }`.
