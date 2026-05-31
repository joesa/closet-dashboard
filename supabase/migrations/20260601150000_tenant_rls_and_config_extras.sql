-- ============================================================================
-- 2026-06-01: Lock down the multi-tenant tables with Row Level Security, hide
-- sensitive columns from the anon key, and add logo/pricing fields so a prospect
-- intake can fully drive the generated site.
--
-- Why: tenants/domains/site_configs were created WITHOUT RLS
-- (20260528140700_multi_tenant_edge.sql). The public marketing sites
-- (custom-closets-websites) read them with the anon key at runtime, which means
-- the anon key could also read every tenant's owner_email / stripe_customer_id
-- and — with the default Supabase DML grants and no RLS — potentially WRITE to
-- these tables. This migration keeps public READ (the sites need it) but blocks
-- writes (service role + admins only) and narrows the columns the anon key can
-- see. The dashboard/admin paths all use the service-role key, which bypasses
-- RLS, so they are unaffected.
--
-- Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enable RLS + policies on tenants / domains / site_configs
-- ---------------------------------------------------------------------------
alter table public.tenants      enable row level security;
alter table public.domains      enable row level security;
alter table public.site_configs enable row level security;

-- Public READ for the anon key only. Runtime rendering resolves a tenant via
-- domains -> tenants -> site_configs using the anon key, so anon needs SELECT.
-- Scoping the policy to `anon` (not all roles) avoids leaking these rows to
-- arbitrary signed-in contractors.
drop policy if exists "public read tenants"      on public.tenants;
drop policy if exists "public read domains"      on public.domains;
drop policy if exists "public read site_configs" on public.site_configs;
create policy "public read tenants"      on public.tenants      for select to anon using (true);
create policy "public read domains"      on public.domains      for select to anon using (true);
create policy "public read site_configs" on public.site_configs for select to anon using (true);

-- Admins (authenticated, is_admin()) get full access for any future direct
-- reads/writes. The service-role key used by provisioning/admin APIs already
-- bypasses RLS, so this is a safety net rather than the primary path.
drop policy if exists "admin all tenants"      on public.tenants;
drop policy if exists "admin all domains"      on public.domains;
drop policy if exists "admin all site_configs" on public.site_configs;
create policy "admin all tenants"      on public.tenants      for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all domains"      on public.domains      for all using (public.is_admin()) with check (public.is_admin());
create policy "admin all site_configs" on public.site_configs for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 2. Narrow the columns the anon key can read
-- ---------------------------------------------------------------------------
-- tenants: the websites app only embeds id/widget_id/site_status. Hide
-- owner_email + stripe_customer_id from anon.
revoke select on public.tenants from anon;
grant  select (id, widget_id, site_status) on public.tenants to anon;

-- contractor_settings: the public widget (anon) only needs branding + pricing
-- (see /api/settings, /api/settings/[id], /api/calculate). Hide contact details,
-- billing, and ownership columns from anon. Authenticated owners (own row via
-- RLS) and the service role are unaffected because column grants are per-role.
revoke select on public.contractor_settings from anon;
grant  select (
  id,
  company_name,
  primary_color_hex,
  price_per_ft_basic,
  price_per_ft_standard,
  price_per_ft_premium,
  price_drawer,
  price_shoe_rack,
  room_pricing,
  disabled_default_rooms,
  disabled_default_finishes
) on public.contractor_settings to anon;

-- ---------------------------------------------------------------------------
-- 3. site_configs: logo + pricing notes, so a prospect intake drives the build
-- ---------------------------------------------------------------------------
-- logo_url: the prospect's uploaded logo (stored in the site-assets bucket),
-- rendered in the site header/nav instead of the plain text brand name.
-- pricing_notes: free-text pricing guidance from the intake, surfaced near the
-- quote calculator CTA.
alter table public.site_configs
  add column if not exists logo_url      text,
  add column if not exists pricing_notes text;
