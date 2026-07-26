-- ============================================================
-- Demo cutover: auth email + aesthetic demo hosts on ditchtheform.com
--
-- 1) Refresh credential guard for demo@ditchtheform.com (still blocks
--    the legacy demo@closetquotes.com address if it reappears).
-- 2) Rename auth.users / auth.identities to demo@ditchtheform.com.
-- 3) Register lumina/ironclad/hearth (+ wehora) on *.ditchtheform.com
--    so custom-closets-websites can resolve them (fixes HTTP 404).
-- ============================================================

create or replace function public.guard_demo_user_credentials()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  demo_email constant text := 'demo@ditchtheform.com';
  legacy_demo_email constant text := 'demo@closetquotes.com';
  jwt_role text;
  is_demo boolean;
begin
  is_demo :=
    lower(coalesce(old.email, '')) in (demo_email, legacy_demo_email)
    or lower(coalesce(new.email, '')) in (demo_email, legacy_demo_email);

  if not is_demo then
    return new;
  end if;

  begin
    jwt_role := current_setting('request.jwt.claims', true)::jsonb ->> 'role';
  exception when others then
    jwt_role := null;
  end;
  if jwt_role = 'service_role' then
    return new;
  end if;

  if current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  if new.encrypted_password is distinct from old.encrypted_password then
    raise exception
      'The demo account password is fixed and managed by the application owner.'
      using errcode = '42501';
  end if;

  if lower(coalesce(new.email, '')) is distinct from lower(coalesce(old.email, '')) then
    raise exception
      'The demo account email is fixed and managed by the application owner.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- Rename demo auth user (idempotent).
update auth.users
   set email = 'demo@ditchtheform.com',
       email_confirmed_at = coalesce(email_confirmed_at, now()),
       updated_at = now()
 where lower(email) = 'demo@closetquotes.com';

update auth.identities
   set identity_data = jsonb_set(
         identity_data,
         '{email}',
         to_jsonb('demo@ditchtheform.com'::text),
         true
       ),
       updated_at = now()
 where provider = 'email'
   and (
     lower(identity_data->>'email') = 'demo@closetquotes.com'
     or user_id in (
       select id from auth.users where lower(email) = 'demo@ditchtheform.com'
     )
   );

do $check$
begin
  if not exists (
    select 1 from auth.users where lower(email) = 'demo@ditchtheform.com'
  ) then
    raise exception
      'Rename failed: demo@ditchtheform.com not present in auth.users.';
  end if;
end
$check$;

-- Platform demo hosts on the new apex (lookup is by exact hostname).
insert into domains (tenant_id, hostname, is_primary, ssl_status, source, vercel_verified)
select d.tenant_id,
       replace(d.hostname, '.closetquotes.com', '.ditchtheform.com'),
       false,
       'active',
       'platform_subdomain',
       true
  from domains d
 where d.hostname in (
   'lumina.closetquotes.com',
   'ironclad.closetquotes.com',
   'hearth.closetquotes.com',
   'wehora-car-wash.closetquotes.com'
 )
on conflict (hostname) do update
  set ssl_status = excluded.ssl_status,
      vercel_verified = true,
      source = 'platform_subdomain',
      last_checked_at = now();
