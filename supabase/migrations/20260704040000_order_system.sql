-- Order-system data model (Phase 2 of the quote-vs-order plan — see
-- 20260704030000_engagement_model.sql for the EngagementModel detection).
-- Businesses with site_configs.engagement_model = 'order' (e.g.
-- restaurants-bars) get a menu -> cart -> order flow instead of the
-- rooms/services -> estimate -> lead-capture quote calculator.

-- ── menu_items ───────────────────────────────────────────────────────────
-- The "order" analog to contractor_rooms: one row per individually-priced
-- menu/catalog item. Populated from the intake's new "Menu Items" step
-- (IntakeFormClient.tsx) at provisioning time.
create table if not exists public.menu_items (
  id            uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractor_settings(id) on delete cascade,
  name          text not null,
  description   text,
  price         numeric(10,2) not null default 0,
  category      text not null default 'Menu',
  image_url     text,
  available     boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists menu_items_contractor_id_idx
  on public.menu_items (contractor_id, sort_order);

alter table public.menu_items enable row level security;

-- Public read by contractor_id — the order widget is anon and queries scoped
-- to one contractor, mirrors contractor_rooms/contractor_addons.
drop policy if exists "Allow public read access on menu_items" on public.menu_items;
create policy "Allow public read access on menu_items"
  on public.menu_items
  for select
  using (true);

-- Owner-only write/delete (same exists-check pattern as contractor_rooms).
drop policy if exists "Allow owner insert on menu_items" on public.menu_items;
create policy "Allow owner insert on menu_items"
  on public.menu_items
  for insert
  with check (
    exists (
      select 1 from public.contractor_settings
      where id = contractor_id and user_id = auth.uid()
    )
  );

drop policy if exists "Allow owner update on menu_items" on public.menu_items;
create policy "Allow owner update on menu_items"
  on public.menu_items
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

drop policy if exists "Allow owner delete on menu_items" on public.menu_items;
create policy "Allow owner delete on menu_items"
  on public.menu_items
  for delete
  using (
    exists (
      select 1 from public.contractor_settings
      where id = contractor_id and user_id = auth.uid()
    )
  );

-- ── orders ───────────────────────────────────────────────────────────────
-- The "order" analog to leads: a denormalized snapshot of a submitted cart
-- (item names/prices captured at submission time so later menu-price
-- changes don't rewrite history — same rationale as leads' quote snapshot).
create table if not exists public.orders (
  id              uuid primary key default gen_random_uuid(),
  contractor_id   uuid not null references public.contractor_settings(id) on delete cascade,
  customer_name   text,
  customer_email  text,
  customer_phone  text,
  -- Array of { id, name, price, quantity } snapshots.
  items           jsonb not null default '[]'::jsonb,
  order_total     numeric(12,2) not null default 0,
  fulfillment_type text not null default 'pickup' check (fulfillment_type in ('pickup', 'delivery')),
  notes           text,
  status          text not null default 'new' check (status in ('new', 'confirmed', 'completed', 'cancelled')),
  source_origin   text,
  user_agent      text,
  ip_hash         text,
  created_at      timestamptz not null default now()
);

create index if not exists orders_contractor_id_created_idx
  on public.orders (contractor_id, created_at desc);

alter table public.orders enable row level security;

drop policy if exists "orders_owner_read" on public.orders;
create policy "orders_owner_read"
  on public.orders for select
  using (
    exists (
      select 1 from public.contractor_settings cs
       where cs.id = contractor_id
         and cs.user_id = auth.uid()
    )
  );

drop policy if exists "orders_admin_read" on public.orders;
create policy "orders_admin_read"
  on public.orders for select
  using (public.is_admin());

-- INSERT is handled exclusively by the /api/send-order route via the
-- service role client, same as leads/api/send-lead. No INSERT policy ->
-- blocked for anon/authenticated.

-- ── prospect_intakes: capture menu items during intake ────────────────────
-- Array of { name, description?, price, category?, imageUrl? } objects
-- entered on the "Menu Items" intake step (order-industry businesses only).
-- Read at provisioning time (buildTemplateSiteConfig.ts) to seed menu_items.
alter table public.prospect_intakes
  add column if not exists menu_items jsonb not null default '[]'::jsonb;
