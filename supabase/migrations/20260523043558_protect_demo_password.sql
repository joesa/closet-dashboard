-- ============================================================
-- Protect the shared demo auth user from password / email
-- changes initiated by anyone other than the application owner.
--
-- Run once in the Supabase SQL Editor (project: closet-dashboard).
--
-- How it works:
--   * `auth.users` is owned by the `supabase_auth_admin` role.
--   * Client-initiated password updates (supabase.auth.updateUser
--     from the browser, or auth.admin.updateUserById called with the
--     ANON key) all flow through the GoTrue service and ultimately
--     perform an UPDATE on `auth.users` as that role.
--   * A BEFORE UPDATE trigger that runs `security definer` checks the
--     row being updated. If the row is the demo user AND the password
--     hash or email is changing, it raises an exception, aborting the
--     update.
--   * The Vercel cron uses the `service_role` key. We allow updates
--     coming through that role by gating on
--     `current_setting('request.jwt.claims', true)` which contains
--     'role":"service_role"' when the request comes from the service
--     role.  Direct SQL Editor edits run as the `postgres` superuser,
--     which is also allowed.
--
-- Net effect:
--   * Demo user cannot change their password or email via the dashboard
--     UI, the Supabase JS SDK, the GoTrue REST endpoints, OR a leaked
--     anon-key API call.
--   * The nightly cron (service-role) can still reset it.
--   * You (the app owner) can still change it from the Supabase
--     Dashboard's Authentication panel, which runs as `postgres`.
-- ============================================================

create or replace function public.guard_demo_user_credentials()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  demo_email constant text := 'demo@closetquotes.com';
  jwt_role text;
begin
  -- Only guard the demo row.
  if lower(coalesce(old.email, '')) <> demo_email
     and lower(coalesce(new.email, '')) <> demo_email then
    return new;
  end if;

  -- Allow the service-role key (used by the nightly cron) to update.
  begin
    jwt_role := current_setting('request.jwt.claims', true)::jsonb ->> 'role';
  exception when others then
    jwt_role := null;
  end;
  if jwt_role = 'service_role' then
    return new;
  end if;

  -- Allow direct superuser edits from the Supabase SQL Editor /
  -- Authentication dashboard (both run as `postgres`).
  if current_user in ('postgres', 'supabase_admin') then
    return new;
  end if;

  -- Block any password change.
  if new.encrypted_password is distinct from old.encrypted_password then
    raise exception
      'The demo account password is fixed and managed by the application owner.'
      using errcode = '42501';
  end if;

  -- Block email changes (otherwise a user could rename the demo
  -- account to dodge this guard, then change the password).
  if lower(coalesce(new.email, '')) is distinct from lower(coalesce(old.email, '')) then
    raise exception
      'The demo account email is fixed and managed by the application owner.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_demo_user_credentials on auth.users;
create trigger guard_demo_user_credentials
before update on auth.users
for each row
execute function public.guard_demo_user_credentials();

-- Sanity check: confirm the demo user exists.
do $check$
begin
  if not exists (select 1 from auth.users where lower(email) = 'demo@closetquotes.com') then
    raise notice 'demo@closetquotes.com is not yet in auth.users; create it from Authentication > Users.';
  end if;
end
$check$;
