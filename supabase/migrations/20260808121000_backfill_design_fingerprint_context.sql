UPDATE public.custom_design_fingerprints fingerprint
SET industry_key = COALESCE(
      fingerprint.industry_key,
      NULLIF(lower(trim(config.industry)), '')
    ),
    market_key = COALESCE(
      fingerprint.market_key,
      NULLIF(
        concat_ws(
          '|',
          NULLIF(lower(trim(config.seo_config->>'addressLocality')), ''),
          NULLIF(lower(trim(config.seo_config->>'addressRegion')), '')
        ),
        ''
      )
    ),
    published_at = CASE
      WHEN fingerprint.status = 'published'
        THEN COALESCE(fingerprint.published_at, fingerprint.updated_at)
      ELSE fingerprint.published_at
    END
FROM public.site_configs config
WHERE config.tenant_id = fingerprint.tenant_id
  AND (
    fingerprint.industry_key IS NULL
    OR fingerprint.market_key IS NULL
    OR (fingerprint.status = 'published' AND fingerprint.published_at IS NULL)
  );