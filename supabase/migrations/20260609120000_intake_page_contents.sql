-- Page-level content authored by the prospect on the intake form.
-- Shape: { "about": "plain text body …", "services": "…", … }
-- Keyed by page slug, values are plain-text copy (max ~1200 words each).
ALTER TABLE public.prospect_intakes
  ADD COLUMN IF NOT EXISTS page_contents JSONB NOT NULL DEFAULT '{}'::jsonb;
