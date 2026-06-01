-- Post-build payments: preview approval, build/balance, maintenance, contractor link.

ALTER TABLE public.prospect_intakes
  ADD COLUMN IF NOT EXISTS build_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS balance_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS maintenance_plan text,
  ADD COLUMN IF NOT EXISTS preview_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS site_live_at timestamptz,
  ADD COLUMN IF NOT EXISTS provisioned_contractor_id uuid REFERENCES public.contractor_settings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS maintenance_started_at timestamptz;

ALTER TABLE public.prospect_intakes
  DROP CONSTRAINT IF EXISTS prospect_intakes_maintenance_plan_check;
ALTER TABLE public.prospect_intakes
  ADD CONSTRAINT prospect_intakes_maintenance_plan_check
  CHECK (maintenance_plan IS NULL OR maintenance_plan IN ('monthly', 'yearly'));

ALTER TABLE public.prospect_intakes
  DROP CONSTRAINT IF EXISTS prospect_intakes_deposit_status_check;
ALTER TABLE public.prospect_intakes
  ADD CONSTRAINT prospect_intakes_deposit_status_check
  CHECK (deposit_status IN ('not_required', 'pending', 'paid', 'failed', 'refunded'));

ALTER TABLE public.intake_payments
  DROP CONSTRAINT IF EXISTS intake_payments_kind_check;
ALTER TABLE public.intake_payments
  ADD CONSTRAINT intake_payments_kind_check
  CHECK (kind IN ('deposit', 'balance', 'standard_build', 'maintenance'));

ALTER TABLE public.intake_payments
  DROP CONSTRAINT IF EXISTS intake_payments_status_check;
ALTER TABLE public.intake_payments
  ADD CONSTRAINT intake_payments_status_check
  CHECK (status IN ('pending', 'paid', 'refunded'));
