-- =============================================================================
-- Scraper Run Results: persist downloadable run outputs in Supabase
-- =============================================================================

create table if not exists public.scraper_run_results (
  run_id            text primary key,
  phase             text not null default 'completed',
  lead_count        integer not null default 0,
  stats             jsonb not null default '{}'::jsonb,
  leads             jsonb not null default '[]'::jsonb,
  webhooks          jsonb not null default '[]'::jsonb,
  artifacts         jsonb not null default '{}'::jsonb,
  target_locations  jsonb not null default '[]'::jsonb,
  selected_cities   jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists scraper_run_results_created_idx
  on public.scraper_run_results (created_at desc);

alter table public.scraper_run_results enable row level security;

drop policy if exists "scraper_run_results_admin_read" on public.scraper_run_results;
create policy "scraper_run_results_admin_read"
  on public.scraper_run_results for select
  using (public.is_admin());
