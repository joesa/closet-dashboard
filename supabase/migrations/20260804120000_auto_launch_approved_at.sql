-- Auto-launch now approves the template site *before* the first Full redesign:
-- an intake submit deploys, goes live, and only then redesigns in place. That
-- splits one idempotency stamp into two, because approval and the post-redesign
-- publish no longer happen at the same moment.
--
-- Without the split, approving early set auto_launch_completed_at, and
-- finishAutoLaunch's "already ran" guard then skipped publishing the finished
-- redesign — the tenant would have been left live on the engine template
-- forever with a completed draft nobody published.
ALTER TABLE public.site_configs
  ADD COLUMN IF NOT EXISTS auto_launch_approved_at TIMESTAMPTZ;

COMMENT ON COLUMN public.site_configs.auto_launch_approved_at IS
  'When the tenant site was taken live without an admin (preview approval + site_status resolved through the launch-payment gate). Set right after the template deploy is serving, before the first Full redesign is queued. Non-null means never re-approve.';

COMMENT ON COLUMN public.site_configs.auto_launch_completed_at IS
  'When the auto-launch finish step (publish the first redesign draft) completed. Non-null means never repeat it; the admin owns the site from that point on.';

-- Tenants that finished under the old redesign-first ordering were approved at
-- the same instant they completed. Backfill so they are not re-approved (which
-- would re-send a launch-payment email to a customer who is already live).
UPDATE public.site_configs
SET auto_launch_approved_at = auto_launch_completed_at
WHERE auto_launch_completed_at IS NOT NULL
  AND auto_launch_approved_at IS NULL;
