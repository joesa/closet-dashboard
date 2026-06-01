-- Tiered intake pricing, AI site config, image selections, deposit payments.

ALTER TABLE public.prospect_intakes
  ADD COLUMN IF NOT EXISTS intake_tier TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS tier_total_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_required_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_paid_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_status TEXT NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS ai_site_config JSONB,
  ADD COLUMN IF NOT EXISTS image_selections JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.prospect_intakes
  DROP CONSTRAINT IF EXISTS prospect_intakes_intake_tier_check;
ALTER TABLE public.prospect_intakes
  ADD CONSTRAINT prospect_intakes_intake_tier_check
  CHECK (intake_tier IN ('standard', 'ai_premium'));

ALTER TABLE public.prospect_intakes
  DROP CONSTRAINT IF EXISTS prospect_intakes_deposit_status_check;
ALTER TABLE public.prospect_intakes
  ADD CONSTRAINT prospect_intakes_deposit_status_check
  CHECK (deposit_status IN ('not_required', 'pending', 'paid', 'failed'));

CREATE TABLE IF NOT EXISTS public.intake_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_id UUID NOT NULL REFERENCES public.prospect_intakes(id) ON DELETE CASCADE,
  stripe_session_id TEXT NOT NULL UNIQUE,
  amount_cents INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'deposit',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_intake_payments_intake
  ON public.intake_payments (intake_id, created_at DESC);

ALTER TABLE public.intake_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "intake_payments_service_role" ON public.intake_payments;
CREATE POLICY "intake_payments_service_role"
  ON public.intake_payments FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "intake_payments_admin_read" ON public.intake_payments;
CREATE POLICY "intake_payments_admin_read"
  ON public.intake_payments FOR SELECT
  USING (public.is_admin());

ALTER TABLE public.provision_jobs
  DROP CONSTRAINT IF EXISTS provision_jobs_mode_check;
ALTER TABLE public.provision_jobs
  ADD CONSTRAINT provision_jobs_mode_check
  CHECK (mode IN ('full', 'widget', 'ai_full'));
