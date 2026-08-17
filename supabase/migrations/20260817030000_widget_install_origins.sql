-- Where is the widget actually installed?
--
-- Until now nothing recorded it. /api/settings answers for any contractor id
-- from any origin (Access-Control-Allow-Origin: *), so a contractor had no way
-- to confirm the snippet was live, support had no way to check, and there was
-- no data to build an allowlist from.
--
-- Recording comes first and enforcement second, deliberately: turning on
-- origin checks without knowing the real distribution of hosts (staging
-- subdomains, page builders that proxy, www vs apex) would break live
-- calculators for people who did nothing wrong.

ALTER TABLE public.contractor_settings
  ADD COLUMN IF NOT EXISTS widget_installed_at timestamptz,
  ADD COLUMN IF NOT EXISTS widget_last_seen_origin text,
  ADD COLUMN IF NOT EXISTS widget_last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS allowed_origins text[];

COMMENT ON COLUMN public.contractor_settings.widget_installed_at IS
  'First time /api/settings was called for this contractor from a browser origin that is not our own dashboard. The install signal.';

COMMENT ON COLUMN public.contractor_settings.widget_last_seen_origin IS
  'Most recent non-platform origin the widget loaded from. Reported in the dashboard so a contractor can confirm the snippet is live.';

COMMENT ON COLUMN public.contractor_settings.allowed_origins IS
  'Reserved for per-contractor origin enforcement. Populated from observed origins first; nothing enforces it yet — see src/lib/cors.ts.';
