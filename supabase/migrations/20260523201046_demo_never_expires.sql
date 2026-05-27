-- ============================================================
-- The shared demo contractor (id = ec376123-f499-4ad4-88c9-2b63ad6f90ab,
-- email = demo@closetquotes.com) is free forever and is not tied to a
-- Stripe subscription. Make the entitlement RPCs short-circuit true for
-- the demo so the middleware never redirects the demo user to /billing
-- when its trial_ends_at drifts into the past.
-- ============================================================

create or replace function public.entitlement(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(
    (select id = 'ec376123-f499-4ad4-88c9-2b63ad6f90ab'::uuid
         or subscription_status = 'active'
         or (subscription_status = 'trialing' and now() < trial_ends_at)
       from public.contractor_settings
      where user_id = p_user_id
      limit 1),
    false
  );
$fn$;

create or replace function public.entitlement_by_contractor(p_contractor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(
    (select id = 'ec376123-f499-4ad4-88c9-2b63ad6f90ab'::uuid
         or subscription_status = 'active'
         or (subscription_status = 'trialing' and now() < trial_ends_at)
       from public.contractor_settings
      where id = p_contractor_id
      limit 1),
    false
  );
$fn$;

grant execute on function public.entitlement(uuid)               to anon, authenticated, service_role;
grant execute on function public.entitlement_by_contractor(uuid) to anon, authenticated, service_role;
