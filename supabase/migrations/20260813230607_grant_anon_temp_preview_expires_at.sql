-- Same failure class as 20260704020100_grant_anon_validation_status.sql: the
-- anon role's SELECT grant on public.tenants is column-scoped. custom-closets-
-- websites' "Honor temporary client preview access" change (getConfig.ts)
-- added tenants.temp_preview_expires_at to the query without extending this
-- grant, so anon got "permission denied for table tenants" on the whole
-- domains -> tenants -> site_configs join, 404ing every tenant site whose
-- gate logic needed the temp preview window (e.g. alvarado-s-tile-
-- installations.ditchtheform.com, awaiting_launch_payment with an active
-- temp_preview_expires_at).
grant select (temp_preview_expires_at) on public.tenants to anon;
