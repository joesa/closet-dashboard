-- Optional platform domain purchase intent (admin fulfills via Vercel Registrar).
-- Default false: BYO is the primary path; purchase is opt-in.
ALTER TABLE public.prospect_intakes
  ADD COLUMN IF NOT EXISTS domain_purchase_requested boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.prospect_intakes.domain_purchase_requested IS
  'When true, prospect asked the platform to buy/register desired_domain; admin purchases after provision. When false, desired_domain is BYO (customer owns registrar).';
