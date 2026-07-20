-- Per-contractor quote-widget appearance preset (see src/lib/widgetThemes.ts).
ALTER TABLE public.contractor_settings
  ADD COLUMN IF NOT EXISTS widget_theme_id text NOT NULL DEFAULT 'alabaster';

COMMENT ON COLUMN public.contractor_settings.widget_theme_id IS
  'Preset id from widgetThemes catalog (surfaces + text + accent as a matched pack).';

-- Public widget reads this via the anon /api/settings client (column-scoped grants).
GRANT SELECT (widget_theme_id) ON public.contractor_settings TO anon;
