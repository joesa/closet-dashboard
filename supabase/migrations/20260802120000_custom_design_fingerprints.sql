-- Cross-tenant uniqueness for Full redesign artifacts.
--
-- catalog/designFingerprint.ts already guarantees ENGINE sites (theme + seed) do
-- not duplicate each other, but Full redesign emits freeform HTML/CSS with no
-- seed: its design exists only in the artifact. Nothing fingerprinted it and
-- nothing compared it to another tenant, so two builds could converge on the
-- same section rhythm, palette and type pairing with no way to detect it.
--
-- A narrow registry table rather than columns on site_configs, deliberately:
-- every new build probes the whole corpus, and site_configs rows carry
-- multi-hundred-KB jsonb (custom_config, custom_config_draft) plus an anon
-- public-read policy. Scanning them per build would pull the entire corpus over
-- the wire on the generation hot path.

CREATE TABLE IF NOT EXISTS public.custom_design_fingerprints (
  tenant_id         uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  version           smallint NOT NULL DEFAULT 1,
  status            text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'published')),
  skeleton_key      text NOT NULL,
  palette_key       text NOT NULL,
  font_key          text NOT NULL,
  shape_key         text NOT NULL,
  motif_key         text NOT NULL,
  fingerprint       jsonb NOT NULL,
  signature_concept text,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Collision probes filter on skeleton; the avoid-list query orders by recency
-- and prefers published rows over drafts.
CREATE INDEX IF NOT EXISTS idx_custom_design_fp_skeleton
  ON public.custom_design_fingerprints (skeleton_key);
CREATE INDEX IF NOT EXISTS idx_custom_design_fp_recent
  ON public.custom_design_fingerprints (status, updated_at DESC);

ALTER TABLE public.custom_design_fingerprints ENABLE ROW LEVEL SECURITY;

-- Nothing here is public: it describes other tenants' designs.
REVOKE ALL PRIVILEGES ON TABLE public.custom_design_fingerprints FROM anon;
GRANT  ALL PRIVILEGES ON TABLE public.custom_design_fingerprints TO service_role;

DROP POLICY IF EXISTS custom_design_fp_admin_all ON public.custom_design_fingerprints;
CREATE POLICY custom_design_fp_admin_all ON public.custom_design_fingerprints
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE public.custom_design_fingerprints IS
  'One row per tenant: the design signature extracted from the emitted custom_config artifact. Read before a Full redesign to build the avoid-list, written at the finalize checkpoint (draft) and at publish (published).';

COMMENT ON COLUMN public.custom_design_fingerprints.skeleton_key IS
  'Ordered home section rhythm, e.g. hero>grid3>split>gallery>band. The only axis that blocks a publish — see BLOCKING_AXES in designGuardPolicy.ts.';

COMMENT ON COLUMN public.custom_design_fingerprints.version IS
  'CUSTOM_FINGERPRINT_VERSION at write time. Rows written by an older extractor are ignored rather than mis-compared.';

COMMENT ON COLUMN public.custom_design_fingerprints.palette_key IS
  'Recorded and shown to the model as already-used, but does not block: platform-wide palette blocking would exhaust the space and start rejecting good designs.';
