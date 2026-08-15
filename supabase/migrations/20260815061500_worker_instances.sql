-- =============================================================================
-- worker_instances — which build of the worker is actually running, and where.
-- =============================================================================
-- The worker is a container on a VM with no inbound port, deployed by a pull
-- based timer (worker-auto-update.timer). Nothing about the running build was
-- observable off the box: answering "did the worker pick up my commit?" meant
-- SSHing in for `git rev-parse HEAD` and `journalctl`. The queue cannot answer
-- it either — with no runnable jobs, a healthy worker and a stopped container
-- look identical from Postgres.
--
-- Each boot registers a row here with the commit baked into the image, then
-- heartbeats. `last_seen_at` going stale is the liveness signal; `git_sha` is
-- the deploy signal. Both readable from anywhere with DB access.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.worker_instances (
    -- One row per container boot, not per host: a redeploy must not overwrite
    -- the previous row, or a crash-looping container would erase the evidence.
    id              text PRIMARY KEY,
    -- NULL when the image was built without a GIT_SHA build arg (a hand-run
    -- `docker compose up --build`). Reported as unknown rather than guessed.
    git_sha         text,
    image_built_at  timestamptz,
    hostname        text,
    concurrency     integer,
    task_ids        text[],
    started_at      timestamptz NOT NULL DEFAULT now(),
    last_seen_at    timestamptz NOT NULL DEFAULT now(),
    -- Set on a graceful shutdown. A SIGKILL leaves it NULL and lets the
    -- heartbeat go stale, which is exactly the distinction worth seeing.
    stopped_at      timestamptz
);

COMMENT ON TABLE public.worker_instances IS
    'One row per Graphile Worker container boot: which commit it runs, when it started, and when it last heartbeat.';
COMMENT ON COLUMN public.worker_instances.git_sha IS
    'Commit baked into the image via the GIT_SHA build arg. NULL when built without one.';
COMMENT ON COLUMN public.worker_instances.stopped_at IS
    'Graceful shutdown only. A killed worker keeps NULL here and stops heartbeating.';

CREATE INDEX IF NOT EXISTS idx_worker_instances_last_seen
    ON public.worker_instances (last_seen_at DESC);

ALTER TABLE public.worker_instances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "worker_instances_service_role" ON public.worker_instances;
CREATE POLICY "worker_instances_service_role"
    ON public.worker_instances FOR ALL
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "worker_instances_admin_read" ON public.worker_instances;
CREATE POLICY "worker_instances_admin_read"
    ON public.worker_instances FOR SELECT
    USING (public.is_admin());
