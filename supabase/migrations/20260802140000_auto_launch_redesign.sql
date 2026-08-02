-- Auto-launch: a submitted intake provisions, runs its first Full redesign,
-- publishes it, and goes live with no admin click. These two stamps are the
-- idempotency record for that unattended sequence — they must survive worker
-- restarts and Graphile retries, so they live on the row rather than in the
-- custom_build_job JSONB (which every new redesign overwrites).
ALTER TABLE public.site_configs
  ADD COLUMN IF NOT EXISTS auto_launch_redesign_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_launch_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.site_configs.auto_launch_redesign_at IS
  'When the automatic first Full redesign was enqueued for this tenant. Non-null means it already ran once — never auto-enqueue again. Admin-triggered redesigns do not set this.';

COMMENT ON COLUMN public.site_configs.auto_launch_completed_at IS
  'When the auto-launch finish step (publish draft + resolve site_status) completed. Non-null means never repeat it; the admin owns the site from that point on.';
