-- Free-form notes from Custom Build (e.g. AI-generated images for brief-added
-- services that were not in the original intake). Append-only JSON array.
ALTER TABLE public.site_configs
  ADD COLUMN IF NOT EXISTS custom_build_notes JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.site_configs.custom_build_notes IS
  'JSON array of Custom Build provenance notes (brief-added service images, etc.).';
