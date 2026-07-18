-- Per-site custom render mode: opt-in escape hatch so one tenant can render
-- AI-built raw HTML/CSS outside the shared template engine, without affecting
-- any other site. Default remains 'engine' for every existing row.

ALTER TABLE public.site_configs
  ADD COLUMN IF NOT EXISTS render_mode TEXT NOT NULL DEFAULT 'engine';

ALTER TABLE public.site_configs
  DROP CONSTRAINT IF EXISTS site_configs_render_mode_check;

ALTER TABLE public.site_configs
  ADD CONSTRAINT site_configs_render_mode_check
  CHECK (render_mode IN ('engine', 'custom'));

-- Published custom-site artifact (live when render_mode = 'custom').
-- Shape: { "mode": "inline"|"iframe", "globalCss"?: string,
--          "pages": { "/": { "html", "css"?, "title"?, "description"? }, ... } }
ALTER TABLE public.site_configs
  ADD COLUMN IF NOT EXISTS custom_config JSONB;

-- Draft artifact (team reviews before publish). Same shape as custom_config.
ALTER TABLE public.site_configs
  ADD COLUMN IF NOT EXISTS custom_config_draft JSONB;

ALTER TABLE public.site_configs
  ADD COLUMN IF NOT EXISTS custom_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.site_configs.render_mode IS
  'engine (default) = shared template engine; custom = render custom_config HTML/CSS for this site only';
COMMENT ON COLUMN public.site_configs.custom_config IS
  'Published per-page HTML/CSS artifact for custom render mode';
COMMENT ON COLUMN public.site_configs.custom_config_draft IS
  'Draft custom artifact awaiting admin publish';
