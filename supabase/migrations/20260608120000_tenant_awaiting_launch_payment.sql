-- Gate public tenant sites until launch payment (balance / standard build) is complete.
-- Custom domains and platform subdomains share the same tenant site_status.

ALTER TYPE public.tenant_site_status ADD VALUE IF NOT EXISTS 'awaiting_launch_payment';

ALTER TABLE public.site_configs
  ADD COLUMN IF NOT EXISTS launch_pay_url text;

COMMENT ON COLUMN public.site_configs.launch_pay_url IS
  'Intake pay-to-launch URL shown on the tenant site while awaiting_launch_payment.';
