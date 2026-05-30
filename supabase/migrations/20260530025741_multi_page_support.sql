-- Add multi-page support to site_configs
ALTER TABLE public.site_configs
ADD COLUMN IF NOT EXISTS nav_links JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS pages_config JSONB NOT NULL DEFAULT '[]'::jsonb;
