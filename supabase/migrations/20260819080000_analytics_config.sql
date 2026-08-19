-- Per-tenant analytics.
--
-- Contractors cannot see their own traffic. They can see leads, but not how
-- many people reached the page and did not convert — which is the number that
-- tells them whether to spend on ads or on the page itself. Renting a website
-- with no analytics is a reason to leave.
--
-- Stored as a small json object rather than columns so a second provider does
-- not need a migration:
--   {"ga4":"G-XXXXXXX"} | {"plausible":"example.com"} | both | {}

alter table public.site_configs
  add column if not exists analytics_config jsonb not null default '{}'::jsonb;

comment on column public.site_configs.analytics_config is
  'Tenant analytics identifiers, e.g. {"ga4":"G-ABC123","plausible":"example.com"}. Rendered into the tenant site head by the renderer. Empty object means no analytics.';

-- Read by the renderer as `anon`; a column missing from the column-level grant
-- makes PostgREST fail the whole select and takes every tenant site down.
grant select (analytics_config) on public.site_configs to anon;
