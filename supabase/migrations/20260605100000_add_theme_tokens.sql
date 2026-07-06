-- Adds an optional synthesized theme token selection to site_configs.
-- Nullable/additive: existing rows are unaffected and continue to render
-- from the `theme` column's ~47 hand-authored palettes. When present,
-- theme_tokens (see ThemeTokenSelection in custom-closets-websites'
-- src/lib/theme.ts) takes over the visual styling as a last-resort
-- alternative for industries/services that don't confidently fit any
-- curated theme.
ALTER TABLE site_configs
ADD COLUMN IF NOT EXISTS theme_tokens JSONB;
