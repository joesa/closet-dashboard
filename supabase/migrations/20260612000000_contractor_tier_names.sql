-- Custom tier display names from the Pro intake wizard (e.g. Founder's Entry / Board Ready / Bespoke).
-- The widget uses these labels on the estimate step; pricing still keys off basic/standard/premium.
ALTER TABLE public.contractor_settings
  ADD COLUMN IF NOT EXISTS tier_names JSONB NOT NULL DEFAULT '{"basic":"Basic","standard":"Standard","premium":"Premium"}'::jsonb;

-- Widget reads tier_names via the anon /api/settings client.
GRANT SELECT (tier_names) ON public.contractor_settings TO anon;
