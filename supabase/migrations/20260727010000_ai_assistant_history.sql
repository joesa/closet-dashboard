-- Durable AI Site Assistant conversation per tenant site.
-- Stored without large image data URLs (text + apply metadata only).
ALTER TABLE public.site_configs
  ADD COLUMN IF NOT EXISTS ai_assistant_history JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.site_configs.ai_assistant_history IS
  'JSON array of AI Site Assistant turns ({role, content, applied?, rejected?, at}) for durable context.';
