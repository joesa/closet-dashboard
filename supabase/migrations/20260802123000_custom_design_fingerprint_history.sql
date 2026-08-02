-- Preserve every distinct Full redesign direction, including prior redesigns
-- for the same tenant. The original tenant_id primary key erased that history.

ALTER TABLE public.custom_design_fingerprints
  DROP CONSTRAINT IF EXISTS custom_design_fingerprints_pkey;

ALTER TABLE public.custom_design_fingerprints
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS artifact_hash text;

UPDATE public.custom_design_fingerprints
SET artifact_hash = COALESCE(fingerprint->>'hash', md5(fingerprint::text))
WHERE artifact_hash IS NULL;

ALTER TABLE public.custom_design_fingerprints
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN artifact_hash SET NOT NULL;

ALTER TABLE public.custom_design_fingerprints
  ADD CONSTRAINT custom_design_fingerprints_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_design_fp_tenant_status_artifact
  ON public.custom_design_fingerprints (tenant_id, status, artifact_hash);

CREATE INDEX IF NOT EXISTS idx_custom_design_fp_tenant_recent
  ON public.custom_design_fingerprints (tenant_id, updated_at DESC);

COMMENT ON TABLE public.custom_design_fingerprints IS
  'Historical design signatures for emitted Full redesign artifacts. Distinct drafts and published designs are retained so future redesigns differ platform-wide and from the same tenant history.';