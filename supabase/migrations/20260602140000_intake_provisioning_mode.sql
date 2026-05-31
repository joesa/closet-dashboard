-- Hold high-touch intakes for admin AI build instead of auto template provision.

ALTER TABLE public.prospect_intakes
  ADD COLUMN IF NOT EXISTS provisioning_mode TEXT NOT NULL DEFAULT 'auto';

ALTER TABLE public.prospect_intakes
  DROP CONSTRAINT IF EXISTS prospect_intakes_provisioning_mode_check;
ALTER TABLE public.prospect_intakes
  ADD CONSTRAINT prospect_intakes_provisioning_mode_check
  CHECK (provisioning_mode IN ('auto', 'manual'));
