-- Lets contractors dismiss the dashboard "Getting started" guide once they've
-- seen it, so it doesn't reappear on every visit; re-openable anytime via the
-- "How this works" link in the dashboard header.

ALTER TABLE public.contractor_settings
  ADD COLUMN IF NOT EXISTS getting_started_dismissed_at timestamptz;

COMMENT ON COLUMN public.contractor_settings.getting_started_dismissed_at IS
  'Timestamp when the contractor dismissed the dashboard getting-started guide card. Null = show it.';
