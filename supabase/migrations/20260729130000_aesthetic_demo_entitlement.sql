-- Keep aesthetic demo widgets entitled after splitting off shared demo id.
-- Lookup by hostname so this stays correct even if tenant UUIDs differ per env.

update public.contractor_settings cs
set
  subscription_status = 'active',
  trial_ends_at = now() + interval '10 years',
  updated_at = now()
where cs.id in (
  select t.widget_id
  from public.domains d
  join public.tenants t on t.id = d.tenant_id
  where lower(d.hostname) in (
    'lumina.ditchtheform.com',
    'ironclad.ditchtheform.com',
    'hearth.ditchtheform.com',
    'lumina.localhost',
    'ironclad.localhost',
    'hearth.localhost'
  )
);

-- Also short-circuit entitlement RPCs for those contractors (defense in depth
-- if subscription_status is ever overwritten).
create or replace function public.entitlement(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(
    (
      select
        cs.id = 'ec376123-f499-4ad4-88c9-2b63ad6f90ab'::uuid
        or exists (
          select 1
          from public.tenants t
          join public.domains d on d.tenant_id = t.id
          where t.widget_id = cs.id
            and lower(d.hostname) in (
              'lumina.ditchtheform.com',
              'ironclad.ditchtheform.com',
              'hearth.ditchtheform.com'
            )
        )
        or cs.subscription_status = 'active'
        or (cs.subscription_status = 'trialing' and now() < cs.trial_ends_at)
      from public.contractor_settings cs
      where cs.user_id = p_user_id
      limit 1
    ),
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
    (
      select
        cs.id = 'ec376123-f499-4ad4-88c9-2b63ad6f90ab'::uuid
        or exists (
          select 1
          from public.tenants t
          join public.domains d on d.tenant_id = t.id
          where t.widget_id = cs.id
            and lower(d.hostname) in (
              'lumina.ditchtheform.com',
              'ironclad.ditchtheform.com',
              'hearth.ditchtheform.com'
            )
        )
        or cs.subscription_status = 'active'
        or (cs.subscription_status = 'trialing' and now() < cs.trial_ends_at)
      from public.contractor_settings cs
      where cs.id = p_contractor_id
      limit 1
    ),
    false
  );
$fn$;

grant execute on function public.entitlement(uuid) to anon, authenticated, service_role;
grant execute on function public.entitlement_by_contractor(uuid) to anon, authenticated, service_role;
