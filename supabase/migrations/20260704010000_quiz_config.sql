-- Optional AI-generated quiz content (the "3-question design quiz" lead
-- capture widget). Nullable/additive: existing rows render the renderer's
-- built-in generic fallback questions until regenerated. Mirrors the
-- hero_config/process_config JSONB pattern already used on this table.
--
-- Shape: { eyebrow?, headline?, questions: [
--   { id: 'frustration'|'style'|'timeline', title: string, options: {id,label}[] }
-- ] } (exactly 3 questions, fixed ids so the widget's data-quiz-* attributes
-- keep working unchanged regardless of industry).
ALTER TABLE site_configs
ADD COLUMN IF NOT EXISTS quiz_config JSONB;
