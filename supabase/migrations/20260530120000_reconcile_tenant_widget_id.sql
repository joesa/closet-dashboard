-- Reconcile tenant.widget_id with contractor_settings (Phase 1 of data-model reconciliation).
--
-- Problem: multi-tenant sites historically reused the shared demo contractor id
-- (ec376123-...) as their widget_id, OR were provisioned with a random uuid that
-- had no matching contractor_settings row. Both cases break the embedded widget:
--   * the demo id triggers the demo-origin gate in /api/calculate & /api/send-lead
--     (403 demo_restricted) on real tenant domains, and
--   * a random widget_id has no contractor_settings row, so /api/calculate 404s.
--
-- Fix: make every tenant's widget_id equal its own tenant id, and guarantee a
-- matching contractor_settings row exists. This establishes a single canonical
-- identity (tenant.id == widget_id == contractor_settings.id) per tenant.

-- 1. Create a contractor_settings row for every tenant that lacks one, keyed by
--    the tenant id. company_name defaults to the tenant's business name.
insert into public.contractor_settings (id, company_name)
select t.id, t.business_name
from public.tenants t
left join public.contractor_settings cs on cs.id = t.id
where cs.id is null;

-- 2. Point every tenant's widget_id at its own (now guaranteed) settings row.
update public.tenants t
set widget_id = t.id
where t.widget_id is distinct from t.id;
