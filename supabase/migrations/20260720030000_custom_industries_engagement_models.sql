-- Align custom_industries.engagement_model with site_configs (quote|order|booking|ticket).
ALTER TABLE public.custom_industries
  DROP CONSTRAINT IF EXISTS custom_industries_engagement_model_check;

ALTER TABLE public.custom_industries
  ADD CONSTRAINT custom_industries_engagement_model_check
  CHECK (engagement_model IN ('quote', 'order', 'booking', 'ticket'));

COMMENT ON COLUMN public.custom_industries.engagement_model IS
  'Which engagement web component to provision: quote|order|booking|ticket.';
