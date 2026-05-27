-- =============================================================================
-- Scraper City Orchestration: dedupe ledger + manual trigger queue
-- =============================================================================

create table if not exists public.scraper_city_ledger (
  city_key           text primary key,
  city_label         text not null,
  first_run_id       text,
  last_run_id        text,
  first_scraped_at   timestamptz not null default now(),
  last_scraped_at    timestamptz not null default now(),
  run_count          integer not null default 1,
  last_source        text not null default 'scraper'
);

create index if not exists scraper_city_ledger_last_scraped_idx
  on public.scraper_city_ledger (last_scraped_at desc);

create table if not exists public.scraper_trigger_requests (
  id                 bigserial primary key,
  mode               text not null default 'manual',
  requested_by       uuid references auth.users(id) on delete set null,
  requested_by_email text,
  trigger_status     text not null default 'queued',
  payload            jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

create index if not exists scraper_trigger_requests_created_idx
  on public.scraper_trigger_requests (created_at desc);

alter table public.scraper_city_ledger enable row level security;
alter table public.scraper_trigger_requests enable row level security;

drop policy if exists "scraper_city_ledger_admin_read" on public.scraper_city_ledger;
create policy "scraper_city_ledger_admin_read"
  on public.scraper_city_ledger for select
  using (public.is_admin());

drop policy if exists "scraper_trigger_requests_admin_read" on public.scraper_trigger_requests;
create policy "scraper_trigger_requests_admin_read"
  on public.scraper_trigger_requests for select
  using (public.is_admin());
