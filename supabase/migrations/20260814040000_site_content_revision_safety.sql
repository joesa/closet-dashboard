-- Make Content Studio mistakes recoverable.
--
-- Incident (2026-08-13): a homepage's <section class="hero"> — carrying the
-- page's only <h1> — was deleted in the WYSIWYG editor. Recovery from History
-- was impossible: in custom mode every editor command rewrites the whole page
-- HTML and autosaves ~700ms later, so ~17 minutes of editing wrote 50+
-- revisions and evicted the pre-deletion snapshot past the OFFSET 50 cutoff.
-- The section had to be recovered by hand out of a stale custom_config_draft.
--
-- Two changes, both in publish_site_content (signature unchanged, so no
-- application code has to move):
--
--   1. Coalesce an autosave burst. Skip the revision INSERT when the newest
--      revision is <2 minutes old AND its changed_paths are identical. We skip
--      rather than overwrite on purpose: the row that survives a burst is then
--      the OLDEST of it — the state before the edit began, which is the one
--      worth keeping.
--   2. Pin a session-start snapshot. The first save after >=30 minutes of quiet
--      is pinned, and pinned rows are evicted on their own, larger budget. That
--      guarantees "the site as it stood before this editing session" survives
--      any amount of churn.
--
-- Verify after applying (against a scratch tenant):
--   -- 60 rapid saves with identical changed_paths should collapse to ~1 row,
--   -- and the surviving pinned row must be the OLDEST, not the newest.
--   select count(*), min(created_at) = min(created_at) filter (where pinned)
--     from site_content_revisions where tenant_id = '<id>';

ALTER TABLE public.site_content_revisions
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pin_reason text;

CREATE INDEX IF NOT EXISTS site_content_revisions_tenant_pinned_idx
  ON public.site_content_revisions (tenant_id, created_at DESC)
  WHERE pinned;

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
  v_last_created timestamptz;
  v_last_paths text[];
  v_pin boolean;
BEGIN
  IF p_actor_user_id IS NULL OR NOT (
    EXISTS (
      SELECT 1
        FROM public.tenants t
        JOIN public.contractor_settings cs ON cs.id = t.widget_id
       WHERE t.id = p_tenant_id
         AND cs.user_id = p_actor_user_id
    )
    OR EXISTS (
      SELECT 1
        FROM public.profiles p
       WHERE p.id = p_actor_user_id
         AND p.is_admin IS TRUE
    )
  ) THEN
    RAISE EXCEPTION 'site_content_actor_forbidden';
  END IF;

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

  SELECT created_at, changed_paths
    INTO v_last_created, v_last_paths
    FROM public.site_content_revisions
   WHERE tenant_id = p_tenant_id
   ORDER BY created_at DESC
   LIMIT 1;

  -- No prior history, or the editor has been idle long enough that this is a
  -- fresh sitting: keep this snapshot permanently as the session's "before".
  v_pin := v_last_created IS NULL OR v_last_created < now() - interval '30 minutes';

  -- Skipping (not overwriting) is what preserves the pre-edit state: within a
  -- burst on the same path the first row already holds it.
  IF v_pin
     OR v_last_created < now() - interval '2 minutes'
     OR v_last_paths IS DISTINCT FROM COALESCE(p_changed_paths, '{}')
  THEN
    INSERT INTO public.site_content_revisions
      (tenant_id, version, actor_user_id, changed_paths, snapshot, pinned, pin_reason)
    VALUES
      (p_tenant_id, v_current, p_actor_user_id, COALESCE(p_changed_paths, '{}'),
       p_previous_snapshot, v_pin, CASE WHEN v_pin THEN 'session_start' END);
  END IF;

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

  -- Pinned rows get their own budget so ordinary churn can never evict them.
  DELETE FROM public.site_content_revisions
   WHERE id IN (
     SELECT id
       FROM public.site_content_revisions
      WHERE tenant_id = p_tenant_id
        AND pinned = false
      ORDER BY created_at DESC
      OFFSET 50
   );
  DELETE FROM public.site_content_revisions
   WHERE id IN (
     SELECT id
       FROM public.site_content_revisions
      WHERE tenant_id = p_tenant_id
        AND pinned = true
      ORDER BY created_at DESC
      OFFSET 20
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
