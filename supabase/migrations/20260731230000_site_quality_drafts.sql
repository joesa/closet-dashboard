-- Validation state for unpublished custom/engine site candidates. This is
-- intentionally separate from tenants.validation_status, which gates the
-- currently published artifact.
ALTER TABLE public.site_configs
  ADD COLUMN IF NOT EXISTS engine_config_draft jsonb,
  ADD COLUMN IF NOT EXISTS draft_artifact_kind text
    CHECK (draft_artifact_kind IN ('custom', 'engine')),
  ADD COLUMN IF NOT EXISTS draft_validation_status text
    CHECK (draft_validation_status IN ('pending', 'passed', 'failed')),
  ADD COLUMN IF NOT EXISTS draft_validation_report jsonb,
  ADD COLUMN IF NOT EXISTS draft_validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS draft_artifact_hash text;

COMMENT ON COLUMN public.site_configs.draft_artifact_hash IS
  'SHA-256 of the exact sanitized draft checked by draft_validation_status; promotion must reject a different hash.';

COMMENT ON COLUMN public.site_configs.engine_config_draft IS
  'Allowlisted unpublished template-engine overrides. Public requests ignore this; authorized draft previews may overlay it.';