-- Async Full redesign jobs (status polled by admin Custom Build UI).
-- One active job per tenant, stored on the site_configs row.
ALTER TABLE public.site_configs
  ADD COLUMN IF NOT EXISTS custom_build_job JSONB;

COMMENT ON COLUMN public.site_configs.custom_build_job IS
  'In-flight or last Full redesign job: { status, intent, prompt, mode, error, reply, started_at, finished_at }. Draft HTML still lives in custom_config_draft.';
