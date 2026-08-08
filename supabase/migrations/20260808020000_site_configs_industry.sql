-- Industry label on site_configs so the public renderer (anon key) can emit
-- industry-correct JSON-LD @type and meta description fallbacks. site_configs
-- already has a blanket anon SELECT policy; contractor_settings.industry has
-- only a column-list grant, so it cannot be read by the renderer directly.

ALTER TABLE public.site_configs
  ADD COLUMN IF NOT EXISTS industry TEXT;

COMMENT ON COLUMN public.site_configs.industry IS
  'Industry / trade label (e.g. "Plumbing", "Med Spa"). Renderer uses it for schema.org @type mapping and meta fallbacks. Not sensitive.';

-- Backfill from contractor_settings via tenants.widget_id (= contractor id).
UPDATE public.site_configs sc
SET industry = cs.industry
FROM public.tenants t
JOIN public.contractor_settings cs ON cs.id = t.widget_id
WHERE t.id = sc.tenant_id
  AND sc.industry IS NULL
  AND cs.industry IS NOT NULL;
