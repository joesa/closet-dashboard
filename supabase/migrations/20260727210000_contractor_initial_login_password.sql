-- Store the initial / temporary client dashboard password so admins can
-- surface-share credentials from Engagement tools. Never grant to anon —
-- column-level grants on contractor_settings already exclude new columns.
ALTER TABLE public.contractor_settings
  ADD COLUMN IF NOT EXISTS initial_login_password text;

COMMENT ON COLUMN public.contractor_settings.initial_login_password IS
  'Temporary password issued at provision (or last admin regenerate). Admin-only; client may have changed it after first login.';
