-- Restrict the anon SELECT grant on site_configs and domains.
--
-- The problem
-- -----------
-- 20260601150000_tenant_rls_and_config_extras.sql:35 granted anon SELECT on
-- site_configs with no column restriction, unlike tenants and
-- contractor_settings which are narrowed in the same file. The anon key is
-- public by design — it ships inside the widget bundle on every customer's
-- site. Verified against production before this change: that key listed all 79
-- site_configs rows and read 22 unpublished `custom_config_draft` values, plus
-- the whole domains table including registrar order ids.
--
-- Prerequisite (done before applying)
-- -----------------------------------
-- The renderer selects custom_config_draft and spec_preview_password_hash. It
-- now reads with SUPABASE_SERVICE_ROLE_KEY (custom-closets-websites/src/lib/
-- getConfig.ts prefers it when present); that variable was set on the websites
-- Vercel project and deployed, and four live tenant sites plus two gated
-- admin-bypass previews were confirmed rendering before this ran.
--
-- Verify after applying, with the anon key:
--   curl "$URL/rest/v1/site_configs?select=custom_config_draft&limit=1" \
--     -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
--   -> must return an error, not rows.
--
-- Rollback, if a render path is found to still need anon:
--   grant select on public.site_configs to anon;
--   grant select on public.domains to anon;

revoke select on public.site_configs from anon;

grant select (
  tenant_id,
  brand_name,
  industry,
  theme,
  layout_style,
  default_room,
  hero_config,
  about_config,
  process_config,
  products_config,
  seo_config,
  before_after_config,
  nav_links,
  pages_config,
  logo_url,
  pricing_notes,
  launch_pay_url,
  design_variant,
  theme_tokens,
  quiz_config,
  engagement_model,
  render_mode,
  edit_in_place,
  custom_config,
  content_structure,
  content_version,
  updated_at
) on public.site_configs to anon;

-- Withheld from anon deliberately: custom_config_draft (unpublished work),
-- engine_config_draft, spec_preview_password_hash, custom_build_job,
-- custom_build_notes, ai_assistant_history, background_job, and the
-- draft_validation_* columns. All are read server-side only.

revoke select on public.domains from anon;

grant select (
  id,
  tenant_id,
  hostname,
  is_primary,
  source,
  ssl_status,
  vercel_verified
) on public.domains to anon;

-- Withheld: registrar_order_id, purchase_price_cents, verification records.
