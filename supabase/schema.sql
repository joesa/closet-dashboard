-- ClosetQuote: contractor_settings table
-- Paste this into the Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- 1. Create the table
create table if not exists public.contractor_settings (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade,
  company_name    text not null default '',
  contact_email   text not null default '',
  primary_color_hex text not null default '#6C47FF',
  price_per_ft_basic   numeric(10,2) not null default 0,
  price_per_ft_standard numeric(10,2) not null default 0,
  price_per_ft_premium  numeric(10,2) not null default 0,
  price_drawer    numeric(10,2) not null default 0,
  price_shoe_rack numeric(10,2) not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 2. Enable Row Level Security
alter table public.contractor_settings enable row level security;

-- 3. Allow anonymous reads (needed for the public widget)
create policy "Allow public read access"
  on public.contractor_settings
  for select
  using (true);

-- 4. Allow authenticated users to insert their own settings
create policy "Allow authenticated insert"
  on public.contractor_settings
  for insert
  with check (auth.uid() = user_id);

create policy "Allow authenticated update"
  on public.contractor_settings
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 5. Auto-update the updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at
  before update on public.contractor_settings
  for each row
  execute function public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- ClosetQuote: contractor_addons table
-- -----------------------------------------------------------------------------

-- 1. Create the table
create table if not exists public.contractor_addons (
  id              uuid primary key default gen_random_uuid(),
  contractor_id   uuid not null references public.contractor_settings(id) on delete cascade,
  room_type       text not null,
  name            text not null,
  price           numeric(10,2) not null default 0,
  created_at      timestamptz not null default now()
);

-- 2. Enable Row Level Security
alter table public.contractor_addons enable row level security;

-- 3. Allow anonymous reads (needed for the public widget to fetch add-ons by contractor_id)
create policy "Allow public read access on addons"
  on public.contractor_addons
  for select
  using (true);

-- 4. Allow authenticated users to manage their own add-ons
-- We check if the auth user owns the parent contractor_settings record
create policy "Allow authenticated insert on addons"
  on public.contractor_addons
  for insert
  with check (
    exists (
      select 1 from public.contractor_settings
      where id = contractor_id and user_id = auth.uid()
    )
  );

create policy "Allow authenticated delete on addons"
  on public.contractor_addons
  for delete
  using (
    exists (
      select 1 from public.contractor_settings
      where id = contractor_id and user_id = auth.uid()
    )
  );

create policy "Allow authenticated update on addons"
  on public.contractor_addons
  for update
  using (
    exists (
      select 1 from public.contractor_settings
      where id = contractor_id and user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.contractor_settings
      where id = contractor_id and user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- Migration: Room-Specific Pricing Matrix (JSONB)
-- -----------------------------------------------------------------------------
-- Replaces the global price_per_ft_basic / _standard / _premium columns with a
-- per-room matrix. The legacy columns are left in place (DEPRECATED) so old
-- clients continue to read; they should be dropped in a follow-up migration
-- once all widgets are on the new schema.
--
-- Room set last updated: expanded from 4 to 14 rooms. Keep this list in sync
-- with ROOM_TYPES / DEFAULT_ROOM_PRICING in src/lib/rooms.ts.

alter table public.contractor_settings
  add column if not exists room_pricing jsonb not null default '{
    "Walk-In Closet":      {"basic": 45, "standard": 65,  "premium": 120},
    "Reach-In Closet":     {"basic": 35, "standard": 55,  "premium": 95},
    "Garage":              {"basic": 60, "standard": 85,  "premium": 150},
    "Pantry & Wine":       {"basic": 25, "standard": 40,  "premium": 75},
    "Home Office":         {"basic": 50, "standard": 75,  "premium": 130},
    "Laundry Room":        {"basic": 30, "standard": 50,  "premium": 85},
    "Mudroom":             {"basic": 40, "standard": 60,  "premium": 100},
    "Entertainment Center":{"basic": 65, "standard": 95,  "premium": 160},
    "Wall Beds":           {"basic": 80, "standard": 110, "premium": 180},
    "Craft Room":          {"basic": 35, "standard": 55,  "premium": 90},
    "Home Library":        {"basic": 70, "standard": 100, "premium": 170},
    "Kid Spaces":          {"basic": 30, "standard": 45,  "premium": 80},
    "Dressing Room":       {"basic": 55, "standard": 85,  "premium": 140},
    "Home Storage":        {"basic": 35, "standard": 55,  "premium": 95}
  }'::jsonb;

-- If the column already existed with the old 4-room default, update the column
-- default so newly-inserted rows get the full 14-room matrix. Safe to re-run.
alter table public.contractor_settings
  alter column room_pricing set default '{
    "Walk-In Closet":      {"basic": 45, "standard": 65,  "premium": 120},
    "Reach-In Closet":     {"basic": 35, "standard": 55,  "premium": 95},
    "Garage":              {"basic": 60, "standard": 85,  "premium": 150},
    "Pantry & Wine":       {"basic": 25, "standard": 40,  "premium": 75},
    "Home Office":         {"basic": 50, "standard": 75,  "premium": 130},
    "Laundry Room":        {"basic": 30, "standard": 50,  "premium": 85},
    "Mudroom":             {"basic": 40, "standard": 60,  "premium": 100},
    "Entertainment Center":{"basic": 65, "standard": 95,  "premium": 160},
    "Wall Beds":           {"basic": 80, "standard": 110, "premium": 180},
    "Craft Room":          {"basic": 35, "standard": 55,  "premium": 90},
    "Home Library":        {"basic": 70, "standard": 100, "premium": 170},
    "Kid Spaces":          {"basic": 30, "standard": 45,  "premium": 80},
    "Dressing Room":       {"basic": 55, "standard": 85,  "premium": 140},
    "Home Storage":        {"basic": 35, "standard": 55,  "premium": 95}
  }'::jsonb;


-- -----------------------------------------------------------------------------
-- Migration: Stripe Subscriptions + 30-Day Free Trial
-- -----------------------------------------------------------------------------
-- Adds subscription tracking to contractor_settings. Trial is tracked in our
-- DB (not Stripe) since we do not collect a card up-front. The Stripe webhook
-- keeps subscription_status / current_period_end in sync after a paid upgrade.
--
-- entitlement(user_id) is the single source of truth: a row is entitled iff
-- it has an active subscription OR is still inside the trial window. Used by
-- middleware (dashboard gate) and the public widget APIs.
--
-- Safe to re-run.

alter table public.contractor_settings
  add column if not exists stripe_customer_id      text,
  add column if not exists stripe_subscription_id  text,
  add column if not exists subscription_status     text not null default 'trialing',
  add column if not exists subscription_plan       text,
  add column if not exists trial_ends_at           timestamptz not null default (now() + interval '30 days'),
  add column if not exists current_period_end      timestamptz;

-- Constrain subscription_status to known values.
do $mig$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'contractor_settings_subscription_status_check'
  ) then
    alter table public.contractor_settings
      drop constraint contractor_settings_subscription_status_check;
  end if;

  alter table public.contractor_settings
    add constraint contractor_settings_subscription_status_check
    check (subscription_status in ('trialing','active','past_due','canceled','incomplete'));
end$mig$;

-- Backfill any rows that pre-existed the migration. Anchor the trial window
-- to created_at so early contractors don't get a fresh 30 days from migration.
update public.contractor_settings
   set trial_ends_at = created_at + interval '30 days'
 where trial_ends_at is null
    or trial_ends_at > created_at + interval '31 days';

create unique index if not exists contractor_settings_stripe_subscription_id_key
  on public.contractor_settings(stripe_subscription_id)
  where stripe_subscription_id is not null;

create index if not exists contractor_settings_stripe_customer_id_idx
  on public.contractor_settings(stripe_customer_id)
  where stripe_customer_id is not null;

-- -----------------------------------------------------------------------------
-- entitlement(): true if actively paying OR still in trial.
-- -----------------------------------------------------------------------------
create or replace function public.entitlement(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(
    (select subscription_status = 'active'
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
    (select subscription_status = 'active'
        or (subscription_status = 'trialing' and now() < trial_ends_at)
       from public.contractor_settings
      where id = p_contractor_id
      limit 1),
    false
  );
$fn$;

grant execute on function public.entitlement(uuid)               to anon, authenticated, service_role;
grant execute on function public.entitlement_by_contractor(uuid) to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Lock down billing columns: only the service-role key (webhook) can write
-- them. Users can still edit branding / pricing.
-- -----------------------------------------------------------------------------
drop policy if exists "Allow authenticated update"                       on public.contractor_settings;
drop policy if exists "Allow authenticated update non-billing fields"    on public.contractor_settings;

create policy "Allow authenticated update non-billing fields"
  on public.contractor_settings
  for update
  using  (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and stripe_customer_id      is not distinct from (select s.stripe_customer_id      from public.contractor_settings s where s.id = contractor_settings.id)
    and stripe_subscription_id  is not distinct from (select s.stripe_subscription_id  from public.contractor_settings s where s.id = contractor_settings.id)
    and subscription_status     is not distinct from (select s.subscription_status     from public.contractor_settings s where s.id = contractor_settings.id)
    and subscription_plan       is not distinct from (select s.subscription_plan       from public.contractor_settings s where s.id = contractor_settings.id)
    and trial_ends_at           is not distinct from (select s.trial_ends_at           from public.contractor_settings s where s.id = contractor_settings.id)
    and current_period_end      is not distinct from (select s.current_period_end      from public.contractor_settings s where s.id = contractor_settings.id)
  );

-- -----------------------------------------------------------------------------
-- handle_new_user(): create a contractor_settings row at signup so the trial
-- clock starts immediately. Idempotent.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.contractor_settings (user_id, contact_email)
  values (new.id, coalesce(new.email, ''))
  on conflict do nothing;
  return new;
end;
$fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Migration: Contractor Custom Rooms
-- -----------------------------------------------------------------------------
-- Lets contractors define their own room types (in addition to the 14 system
-- defaults stored in contractor_settings.room_pricing). Each row is scoped to
-- one contractor; the widget loads them via the same /api/settings response.
-- Safe to re-run.

create table if not exists public.contractor_rooms (
  id              uuid primary key default gen_random_uuid(),
  contractor_id   uuid not null references public.contractor_settings(id) on delete cascade,
  name            text not null,
  price_basic     numeric(10,2) not null default 0,
  price_standard  numeric(10,2) not null default 0,
  price_premium   numeric(10,2) not null default 0,
  created_at      timestamptz not null default now(),
  unique (contractor_id, name)
);

create index if not exists contractor_rooms_contractor_id_idx
  on public.contractor_rooms(contractor_id);

alter table public.contractor_rooms enable row level security;

-- Public read by contractor_id (the widget is anon and queries scoped to one
-- contractor, so this only ever surfaces that contractor's own customs).
drop policy if exists "Allow public read access on rooms" on public.contractor_rooms;
create policy "Allow public read access on rooms"
  on public.contractor_rooms
  for select
  using (true);

-- Owner-only write/delete, matching the contractor_addons pattern.
drop policy if exists "Allow owner insert on rooms" on public.contractor_rooms;
create policy "Allow owner insert on rooms"
  on public.contractor_rooms
  for insert
  with check (
    exists (
      select 1 from public.contractor_settings
      where id = contractor_id and user_id = auth.uid()
    )
  );

drop policy if exists "Allow owner update on rooms" on public.contractor_rooms;
create policy "Allow owner update on rooms"
  on public.contractor_rooms
  for update
  using (
    exists (
      select 1 from public.contractor_settings
      where id = contractor_id and user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.contractor_settings
      where id = contractor_id and user_id = auth.uid()
    )
  );

drop policy if exists "Allow owner delete on rooms" on public.contractor_rooms;
create policy "Allow owner delete on rooms"
  on public.contractor_rooms
  for delete
  using (
    exists (
      select 1 from public.contractor_settings
      where id = contractor_id and user_id = auth.uid()
    )
  );

-- Also tighten contractor_addons: existing policy uses public read which is
-- correct (widget needs them by contractor_id). No changes required there.

-- -----------------------------------------------------------------------------
-- Migration: Contractor Custom Finishes + Disable Default Rooms/Finishes
-- -----------------------------------------------------------------------------
-- Lets contractors:
--   (a) define their own material/color finishes (e.g. "Walnut Veneer") with
--       a swatch color, mapped to one of the three pricing tiers so the
--       per-foot pricing logic stays simple.
--   (b) hide system-default rooms or finishes they don't offer.
-- Safe to re-run.

create table if not exists public.contractor_finishes (
  id              uuid primary key default gen_random_uuid(),
  contractor_id   uuid not null references public.contractor_settings(id) on delete cascade,
  label           text not null,
  description     text,
  swatch_hex      text not null default '#cccccc',
  tier            text not null check (tier in ('basic','standard','premium')),
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  unique (contractor_id, label)
);

create index if not exists contractor_finishes_contractor_id_idx
  on public.contractor_finishes(contractor_id);

alter table public.contractor_finishes enable row level security;

drop policy if exists "Allow public read access on finishes" on public.contractor_finishes;
create policy "Allow public read access on finishes"
  on public.contractor_finishes
  for select
  using (true);

drop policy if exists "Allow owner insert on finishes" on public.contractor_finishes;
create policy "Allow owner insert on finishes"
  on public.contractor_finishes
  for insert
  with check (
    exists (
      select 1 from public.contractor_settings
      where id = contractor_id and user_id = auth.uid()
    )
  );

drop policy if exists "Allow owner update on finishes" on public.contractor_finishes;
create policy "Allow owner update on finishes"
  on public.contractor_finishes
  for update
  using (
    exists (
      select 1 from public.contractor_settings
      where id = contractor_id and user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.contractor_settings
      where id = contractor_id and user_id = auth.uid()
    )
  );

drop policy if exists "Allow owner delete on finishes" on public.contractor_finishes;
create policy "Allow owner delete on finishes"
  on public.contractor_finishes
  for delete
  using (
    exists (
      select 1 from public.contractor_settings
      where id = contractor_id and user_id = auth.uid()
    )
  );

-- Disabled defaults: arrays of system room labels / finish tier ids the
-- contractor wants HIDDEN from their widget. Empty default = show everything.
alter table public.contractor_settings
  add column if not exists disabled_default_rooms text[] not null default '{}';

alter table public.contractor_settings
  add column if not exists disabled_default_finishes text[] not null default '{}';

-- ============================================================================
-- 2026-05-21: contact_phone — contractor's personal cell for SMS lead alerts.
-- Twilio sends a detailed new-lead text to this number on every widget submit.
-- ============================================================================
alter table public.contractor_settings
  add column if not exists contact_phone text;
