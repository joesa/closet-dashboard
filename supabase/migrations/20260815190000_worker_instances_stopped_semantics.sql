-- worker_instances.stopped_at now means "shutdown was requested", not
-- "the drain finished".
--
-- The original wording described an intent the code did not achieve: graphile
-- worker installs its own signal handlers and exited the process before the
-- registry write reached Postgres, so every clean redeploy was recorded as a
-- crash. The worker now owns SIGTERM/SIGINT and writes this column when the
-- signal arrives — before draining, because a Full redesign can outlive
-- docker's 60s stop grace and a deliberate stop that gets SIGKILLed mid-drain
-- should still read as deliberate.

COMMENT ON COLUMN public.worker_instances.stopped_at IS
    'Set when shutdown is requested (not when the drain ends). A crash or OOM keeps NULL here and stops heartbeating.';
