ALTER TABLE public.custom_design_fingerprints
  ADD COLUMN IF NOT EXISTS industry_key text,
  ADD COLUMN IF NOT EXISTS market_key text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_custom_design_fp_font_recent
  ON public.custom_design_fingerprints (font_key, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_custom_design_fp_industry_font_recent
  ON public.custom_design_fingerprints (industry_key, font_key, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_custom_design_fp_market_font_recent
  ON public.custom_design_fingerprints (market_key, font_key, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.custom_design_direction_reservations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_key         text NOT NULL,
  direction_key   text NOT NULL,
  font_key        text NOT NULL,
  palette_key     text NOT NULL,
  composition_key text NOT NULL,
  signature_key   text NOT NULL,
  industry_key    text,
  market_key      text,
  status          text NOT NULL DEFAULT 'reserved'
                    CHECK (status IN ('reserved', 'consumed', 'released')),
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '60 minutes'),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_design_direction_active
  ON public.custom_design_direction_reservations (direction_key)
  WHERE status = 'reserved';
CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_design_direction_job_active
  ON public.custom_design_direction_reservations (tenant_id, job_key)
  WHERE status = 'reserved';
CREATE INDEX IF NOT EXISTS idx_custom_design_direction_expiry
  ON public.custom_design_direction_reservations (expires_at)
  WHERE status = 'reserved';

ALTER TABLE public.custom_design_direction_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.custom_design_direction_reservations FROM anon;
GRANT ALL PRIVILEGES ON TABLE public.custom_design_direction_reservations TO service_role;

DROP POLICY IF EXISTS custom_design_direction_admin_all
  ON public.custom_design_direction_reservations;
CREATE POLICY custom_design_direction_admin_all
  ON public.custom_design_direction_reservations
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.reserve_custom_design_direction(
  p_tenant_id uuid,
  p_job_key text,
  p_direction_key text,
  p_font_key text,
  p_palette_key text,
  p_composition_key text,
  p_signature_key text,
  p_industry_key text DEFAULT NULL,
  p_market_key text DEFAULT NULL
)
RETURNS SETOF public.custom_design_direction_reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.custom_design_direction_reservations
  SET status = 'released', updated_at = now()
  WHERE status = 'reserved' AND expires_at <= now();

  RETURN QUERY
  SELECT * FROM public.custom_design_direction_reservations
  WHERE tenant_id = p_tenant_id AND job_key = p_job_key
    AND status = 'reserved'
  LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  RETURN QUERY
  INSERT INTO public.custom_design_direction_reservations (
    tenant_id, job_key, direction_key, font_key, palette_key,
    composition_key, signature_key, industry_key, market_key
  ) VALUES (
    p_tenant_id, p_job_key, p_direction_key, p_font_key, p_palette_key,
    p_composition_key, p_signature_key, p_industry_key, p_market_key
  )
  ON CONFLICT DO NOTHING
  RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_custom_design_direction_reservation(
  p_reservation_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('consumed', 'released') THEN
    RAISE EXCEPTION 'invalid reservation status';
  END IF;
  UPDATE public.custom_design_direction_reservations
  SET status = p_status, updated_at = now()
  WHERE id = p_reservation_id AND status = 'reserved';
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_custom_design_direction(uuid,text,text,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_custom_design_direction(uuid,text,text,text,text,text,text,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.finish_custom_design_direction_reservation(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finish_custom_design_direction_reservation(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.publish_custom_site_with_fingerprint(
  p_tenant_id uuid,
  p_custom_config jsonb,
  p_validation_status text,
  p_validation_report jsonb,
  p_validated_at timestamptz,
  p_artifact_hash text,
  p_fingerprint_version smallint,
  p_skeleton_key text,
  p_palette_key text,
  p_font_key text,
  p_shape_key text,
  p_motif_key text,
  p_fingerprint_artifact_hash text,
  p_fingerprint jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_industry_key text;
  v_market_key text;
  v_signature_concept text;
BEGIN
  SELECT industry_key, market_key, signature_concept
  INTO v_industry_key, v_market_key, v_signature_concept
  FROM public.custom_design_fingerprints
  WHERE tenant_id = p_tenant_id
    AND artifact_hash = p_fingerprint_artifact_hash
  ORDER BY (status = 'draft') DESC, updated_at DESC
  LIMIT 1;

  UPDATE public.site_configs
  SET custom_config = p_custom_config,
      render_mode = 'custom',
      draft_artifact_kind = 'custom',
      draft_validation_status = p_validation_status,
      draft_validation_report = p_validation_report,
      draft_validated_at = p_validated_at,
      draft_artifact_hash = p_artifact_hash,
      custom_updated_at = now()
  WHERE tenant_id = p_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'site config not found for tenant %', p_tenant_id;
  END IF;

  INSERT INTO public.custom_design_fingerprints (
    tenant_id, version, status, skeleton_key, palette_key, font_key,
    shape_key, motif_key, artifact_hash, fingerprint, signature_concept,
    industry_key, market_key, published_at, updated_at
  ) VALUES (
    p_tenant_id, p_fingerprint_version, 'published', p_skeleton_key,
    p_palette_key, p_font_key, p_shape_key, p_motif_key,
    p_fingerprint_artifact_hash, p_fingerprint, v_signature_concept,
    v_industry_key, v_market_key, now(), now()
  )
  ON CONFLICT (tenant_id, status, artifact_hash)
  DO UPDATE SET
    fingerprint = EXCLUDED.fingerprint,
    skeleton_key = EXCLUDED.skeleton_key,
    palette_key = EXCLUDED.palette_key,
    font_key = EXCLUDED.font_key,
    shape_key = EXCLUDED.shape_key,
    motif_key = EXCLUDED.motif_key,
    industry_key = COALESCE(EXCLUDED.industry_key, custom_design_fingerprints.industry_key),
    market_key = COALESCE(EXCLUDED.market_key, custom_design_fingerprints.market_key),
    published_at = now(),
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.publish_custom_site_with_fingerprint(uuid,jsonb,text,jsonb,timestamptz,text,smallint,text,text,text,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_custom_site_with_fingerprint(uuid,jsonb,text,jsonb,timestamptz,text,smallint,text,text,text,text,text,text,jsonb) TO service_role;