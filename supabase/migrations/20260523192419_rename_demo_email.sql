-- ============================================================
-- Rename the demo auth user from demo@closetquote.com to
-- demo@closetquotes.com (the marketing domain we actually own).
--
-- Order of operations matters:
--   1. Replace public.guard_demo_user_credentials() so the
--      guard's demo_email constant points at the NEW address.
--      Without this the trigger would still allow the rename
--      (it runs as `postgres` during migration), but afterwards
--      the demo row would no longer be guarded.
--   2. UPDATE auth.users to the new email.
--   3. UPDATE auth.identities so the email-provider identity_data
--      stays in sync (login uses identities.identity_data->>'email').
-- ============================================================

-- Step 1: refresh the guard with the new constant.
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
  if lower(coalesce(old.email, '')) <> demo_email
     and lower(coalesce(new.email, '')) <> demo_email then
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

-- Step 2: rename in auth.users.
update auth.users
   set email = 'demo@closetquotes.com'
 where lower(email) = 'demo@closetquote.com';

-- Step 3: keep auth.identities in sync for the email provider so that
-- Supabase's login lookup (identities.identity_data->>'email') still
-- resolves to the demo row.
update auth.identities
   set identity_data = jsonb_set(identity_data, '{email}', to_jsonb('demo@closetquotes.com'::text), true)
 where provider = 'email'
   and lower(identity_data->>'email') = 'demo@closetquote.com';

-- Sanity check.
do $check$
begin
  if not exists (select 1 from auth.users where lower(email) = 'demo@closetquotes.com') then
    raise exception 'Rename failed: demo@closetquotes.com not present in auth.users.';
  end if;
end
$check$;
