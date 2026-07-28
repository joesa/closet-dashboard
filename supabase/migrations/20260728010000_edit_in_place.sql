-- Admin edit-in-place mode for custom sites.
-- When true, public visitors see a holding page; admin may edit via bypass + edit token.

ALTER TABLE public.site_configs
  ADD COLUMN IF NOT EXISTS edit_in_place boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.site_configs.edit_in_place IS
  'When true, public site is held offline; admin may edit custom HTML in place via bypass.';
