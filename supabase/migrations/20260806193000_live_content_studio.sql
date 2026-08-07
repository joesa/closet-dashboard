-- Live Website Content Studio: optimistic versions + restorable published snapshots.

ALTER TABLE public.site_configs
  ADD COLUMN IF NOT EXISTS content_version bigint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS content_structure jsonb NOT NULL DEFAULT
    '{"homeSections":["hero","about","products","process","beforeAfter","socialProof","quiz","engagement"],"hiddenHomeSections":[]}'::jsonb,
  ADD COLUMN IF NOT EXISTS content_studio_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.site_content_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  version bigint NOT NULL,
  actor_user_id uuid,
  changed_paths text[] NOT NULL DEFAULT '{}',
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, version)
);

CREATE INDEX IF NOT EXISTS site_content_revisions_tenant_created_idx
  ON public.site_content_revisions (tenant_id, created_at DESC);

ALTER TABLE public.site_content_revisions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.site_content_idempotency (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  resulting_version bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, idempotency_key)
);
ALTER TABLE public.site_content_idempotency ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.site_content_revisions IS
  'Published website snapshots created immediately before each Content Studio mutation.';

-- This function is service-role only. It locks the site row, verifies the
-- caller-supplied version, records the previous published state, replaces the
-- editable document, increments the version, and prunes history atomically.
CREATE OR REPLACE FUNCTION public.publish_site_content(
  p_tenant_id uuid,
  p_expected_version bigint,
  p_actor_user_id uuid,
  p_idempotency_key text,
  p_changed_paths text[],
  p_previous_snapshot jsonb,
  p_document jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current bigint;
  v_next bigint;
BEGIN
  SELECT resulting_version
    INTO v_next
    FROM public.site_content_idempotency
   WHERE tenant_id = p_tenant_id
     AND idempotency_key = p_idempotency_key;
  IF v_next IS NOT NULL THEN
    RETURN v_next;
  END IF;

  SELECT content_version
    INTO v_current
    FROM public.site_configs
   WHERE tenant_id = p_tenant_id
   FOR UPDATE;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'site_config_not_found';
  END IF;
  IF v_current <> p_expected_version THEN
    RAISE EXCEPTION 'content_version_conflict:%', v_current;
  END IF;

  INSERT INTO public.site_content_revisions
    (tenant_id, version, actor_user_id, changed_paths, snapshot)
  VALUES
    (p_tenant_id, v_current, p_actor_user_id, COALESCE(p_changed_paths, '{}'), p_previous_snapshot);

  v_next := v_current + 1;
  UPDATE public.site_configs
     SET brand_name = p_document->>'brand_name',
         hero_config = COALESCE(p_document->'hero_config', '{}'::jsonb),
         about_config = COALESCE(p_document->'about_config', '{}'::jsonb),
         process_config = COALESCE(p_document->'process_config', '{"steps":[]}'::jsonb),
         products_config = COALESCE(p_document->'products_config', '[]'::jsonb),
         seo_config = COALESCE(p_document->'seo_config', '{}'::jsonb),
         before_after_config = CASE
           WHEN p_document ? 'before_after_config' THEN NULLIF(p_document->'before_after_config', 'null'::jsonb)
           ELSE NULL
         END,
         quiz_config = CASE
           WHEN p_document ? 'quiz_config' THEN NULLIF(p_document->'quiz_config', 'null'::jsonb)
           ELSE NULL
         END,
         nav_links = COALESCE(p_document->'nav_links', '[]'::jsonb),
         pages_config = COALESCE(p_document->'pages_config', '[]'::jsonb),
         logo_url = NULLIF(p_document->>'logo_url', ''),
         pricing_notes = NULLIF(p_document->>'pricing_notes', ''),
         custom_config = CASE
           WHEN p_document ? 'custom_config' THEN p_document->'custom_config'
           ELSE custom_config
         END,
         content_structure = COALESCE(p_document->'content_structure', '{}'::jsonb),
         content_version = v_next,
         custom_updated_at = CASE
           WHEN render_mode = 'custom' THEN now()
           ELSE custom_updated_at
         END,
         updated_at = now()
   WHERE tenant_id = p_tenant_id;

  INSERT INTO public.site_content_idempotency
    (tenant_id, idempotency_key, resulting_version)
  VALUES (p_tenant_id, p_idempotency_key, v_next);

  DELETE FROM public.site_content_revisions
   WHERE id IN (
     SELECT id
       FROM public.site_content_revisions
      WHERE tenant_id = p_tenant_id
      ORDER BY created_at DESC
      OFFSET 50
   );
  DELETE FROM public.site_content_idempotency
   WHERE tenant_id = p_tenant_id
     AND created_at < now() - interval '24 hours';

  RETURN v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_site_content(uuid, bigint, uuid, text, text[], jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_site_content(uuid, bigint, uuid, text, text[], jsonb, jsonb)
  TO service_role;
