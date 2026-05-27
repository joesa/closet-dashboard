-- =============================================================================
-- Admin Phase 1: profiles + leads + quote_events + audit log + webhook log
-- =============================================================================
-- Foundation for the owner-only /admin surface. Adds:
--   1. public.profiles            — mirror of auth.users with is_admin flag
--   2. public.leads               — every lead submitted via /api/send-lead
--   3. public.quote_events        — every quote calculated via /api/calculate
--   4. public.admin_audit_log     — every privileged admin action
--   5. public.stripe_webhook_events — raw Stripe events as they arrive
--
-- Also installs an is_admin() SECURITY DEFINER helper and broad RLS policies
-- that grant admins read access to all rows in every table introduced here
-- (and the existing contractor_settings / contractor_addons / contractor_rooms
-- / contractor_finishes tables).
--
-- Safe to re-run.
-- =============================================================================

-- ── 1. profiles + is_admin() ────────────────────────────────────────────────

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A user may read / update their own profile row, but never the is_admin flag.
drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_self_read"
  on public.profiles for select
  using (id = auth.uid());

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and is_admin = (select is_admin from public.profiles where id = auth.uid()));

-- Backfill / keep in sync with auth.users.
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
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email on auth.users
  for each row execute function public.handle_new_auth_user();

-- Backfill existing users into profiles.
insert into public.profiles (id, email)
  select id, email from auth.users
  on conflict (id) do update set email = excluded.email;

-- Seed admins (owner emails). Update is_admin if the user already exists.
update public.profiles
   set is_admin = true,
       updated_at = now()
 where lower(email) in (
   'joesa73@gmail.com',
   'admin@closetquotes.com',
   'jsa4717@hotmail.com'
 );

-- is_admin() — call from RLS policies. SECURITY DEFINER bypasses RLS on
-- profiles so the policy on profiles itself doesn't recurse.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

-- Admin read-everything policies on profiles itself.
drop policy if exists "profiles_admin_read_all" on public.profiles;
create policy "profiles_admin_read_all"
  on public.profiles for select
  using (public.is_admin());

drop policy if exists "profiles_admin_update_all" on public.profiles;
create policy "profiles_admin_update_all"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

-- ── 2. leads ────────────────────────────────────────────────────────────────

create table if not exists public.leads (
  id              uuid primary key default gen_random_uuid(),
  contractor_id   uuid not null references public.contractor_settings(id) on delete cascade,
  -- Lead contact info (collected by widget form).
  first_name      text,
  last_name       text,
  email           text,
  phone           text,
  message         text,
  -- Quote snapshot at the moment of submission (denormalized intentionally so
  -- pricing changes later don't rewrite history).
  room_type       text,
  finish_type     text,
  linear_feet     numeric(10,2),
  estimated_total numeric(12,2),
  range_low       numeric(12,2),
  range_high      numeric(12,2),
  add_ons         jsonb not null default '[]'::jsonb,
  -- Request metadata for fraud / debugging.
  source_origin   text,
  user_agent      text,
  ip_hash         text,
  created_at      timestamptz not null default now()
);

create index if not exists leads_contractor_id_created_idx
  on public.leads (contractor_id, created_at desc);
create index if not exists leads_created_idx
  on public.leads (created_at desc);

alter table public.leads enable row level security;

drop policy if exists "leads_owner_read" on public.leads;
create policy "leads_owner_read"
  on public.leads for select
  using (
    exists (
      select 1 from public.contractor_settings cs
       where cs.id = contractor_id
         and cs.user_id = auth.uid()
    )
  );

drop policy if exists "leads_admin_read" on public.leads;
create policy "leads_admin_read"
  on public.leads for select
  using (public.is_admin());

-- INSERT is handled exclusively by the /api/send-lead route via the service
-- role client. No INSERT policy → blocked for anon / authenticated.

-- ── 3. quote_events ────────────────────────────────────────────────────────

create table if not exists public.quote_events (
  id              bigserial primary key,
  contractor_id   uuid not null references public.contractor_settings(id) on delete cascade,
  room_type       text,
  finish_type     text,
  linear_feet     numeric(10,2),
  estimated_total numeric(12,2),
  add_ons_count   int  not null default 0,
  source_origin   text,
  ip_hash         text,
  created_at      timestamptz not null default now()
);

create index if not exists quote_events_contractor_created_idx
  on public.quote_events (contractor_id, created_at desc);
create index if not exists quote_events_created_idx
  on public.quote_events (created_at desc);

alter table public.quote_events enable row level security;

drop policy if exists "quote_events_owner_read" on public.quote_events;
create policy "quote_events_owner_read"
  on public.quote_events for select
  using (
    exists (
      select 1 from public.contractor_settings cs
       where cs.id = contractor_id
         and cs.user_id = auth.uid()
    )
  );

drop policy if exists "quote_events_admin_read" on public.quote_events;
create policy "quote_events_admin_read"
  on public.quote_events for select
  using (public.is_admin());

-- ── 4. admin_audit_log ─────────────────────────────────────────────────────

create table if not exists public.admin_audit_log (
  id            bigserial primary key,
  actor_id      uuid references auth.users(id) on delete set null,
  actor_email   text,
  action        text not null,         -- e.g. 'extend_trial', 'comp_account', 'refund'
  target_type   text,                  -- e.g. 'contractor', 'subscription'
  target_id     text,                  -- free-form id (uuid, stripe id, etc.)
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc);
create index if not exists admin_audit_log_target_idx
  on public.admin_audit_log (target_type, target_id);

alter table public.admin_audit_log enable row level security;

drop policy if exists "audit_admin_read" on public.admin_audit_log;
create policy "audit_admin_read"
  on public.admin_audit_log for select
  using (public.is_admin());

-- Writes happen exclusively via service role (server actions) — no INSERT
-- policy means non-admin and unauthenticated callers can't write.

-- ── 5. stripe_webhook_events ───────────────────────────────────────────────

create table if not exists public.stripe_webhook_events (
  id            text primary key,            -- Stripe evt_xxx id (idempotency)
  type          text not null,
  livemode      boolean,
  customer_id   text,
  payload       jsonb not null,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz,
  process_error text
);

create index if not exists stripe_webhook_events_received_idx
  on public.stripe_webhook_events (received_at desc);
create index if not exists stripe_webhook_events_customer_idx
  on public.stripe_webhook_events (customer_id);
create index if not exists stripe_webhook_events_type_idx
  on public.stripe_webhook_events (type);

alter table public.stripe_webhook_events enable row level security;

drop policy if exists "webhook_admin_read" on public.stripe_webhook_events;
create policy "webhook_admin_read"
  on public.stripe_webhook_events for select
  using (public.is_admin());

-- ── 6. Admin read-all on existing contractor tables ────────────────────────

drop policy if exists "contractor_settings_admin_read_all" on public.contractor_settings;
create policy "contractor_settings_admin_read_all"
  on public.contractor_settings for select
  using (public.is_admin());

drop policy if exists "contractor_settings_admin_update_all" on public.contractor_settings;
create policy "contractor_settings_admin_update_all"
  on public.contractor_settings for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "contractor_addons_admin_read_all" on public.contractor_addons;
create policy "contractor_addons_admin_read_all"
  on public.contractor_addons for select
  using (public.is_admin());

-- contractor_rooms / contractor_finishes — guarded conditionally in case the
-- tables don't exist in some environments.
do $mig$
begin
  if to_regclass('public.contractor_rooms') is not null then
    execute 'drop policy if exists "contractor_rooms_admin_read_all" on public.contractor_rooms';
    execute 'create policy "contractor_rooms_admin_read_all" on public.contractor_rooms for select using (public.is_admin())';
  end if;
  if to_regclass('public.contractor_finishes') is not null then
    execute 'drop policy if exists "contractor_finishes_admin_read_all" on public.contractor_finishes';
    execute 'create policy "contractor_finishes_admin_read_all" on public.contractor_finishes for select using (public.is_admin())';
  end if;
end$mig$;
