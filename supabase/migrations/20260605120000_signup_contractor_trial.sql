-- Restore contractor_settings creation on auth signup (admin migration replaced
-- the trigger with profiles-only handle_new_auth_user).

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email, updated_at = now();

  if not exists (
    select 1 from public.contractor_settings where user_id = new.id
  ) then
    insert into public.contractor_settings (
      user_id,
      contact_email,
      subscription_status,
      trial_ends_at
    )
    values (
      new.id,
      coalesce(new.email, ''),
      'trialing',
      now() + interval '30 days'
    );
  end if;

  return new;
end;
$$;

-- Users who signed up after admin_phase1 but before this fix.
insert into public.contractor_settings (
  user_id,
  contact_email,
  subscription_status,
  trial_ends_at
)
select
  u.id,
  coalesce(u.email, ''),
  'trialing',
  now() + interval '30 days'
from auth.users u
where not exists (
  select 1 from public.contractor_settings cs where cs.user_id = u.id
);
