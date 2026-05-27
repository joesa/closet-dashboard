-- =============================================================================
-- Scraper Control Plane: config storage + history + run status telemetry
-- =============================================================================
-- Adds:
--   1) public.scraper_config         - singleton active scraper settings
--   2) public.scraper_config_history - append-only change history snapshots
--   3) public.scraper_run_events     - run lifecycle/status telemetry
--
-- Safe to re-run.
-- =============================================================================

create table if not exists public.scraper_config (
  id                text primary key default 'default',
  settings          jsonb not null default '{}'::jsonb,
  updated_by        uuid references auth.users(id) on delete set null,
  updated_by_email  text,
  updated_at        timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  constraint scraper_config_singleton_chk check (id = 'default')
);

create table if not exists public.scraper_config_history (
  id                bigserial primary key,
  config_id         text not null default 'default',
  settings          jsonb not null,
  changed_by        uuid references auth.users(id) on delete set null,
  changed_by_email  text,
  change_note       text,
  created_at        timestamptz not null default now()
);

create index if not exists scraper_config_history_created_idx
  on public.scraper_config_history (created_at desc);

create index if not exists scraper_config_history_config_idx
  on public.scraper_config_history (config_id, created_at desc);

create table if not exists public.scraper_run_events (
  id                bigserial primary key,
  run_id            text,
  phase             text not null,
  source            text not null default 'scraper',
  payload           jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

create index if not exists scraper_run_events_created_idx
  on public.scraper_run_events (created_at desc);

create index if not exists scraper_run_events_run_idx
  on public.scraper_run_events (run_id, created_at desc);

alter table public.scraper_config enable row level security;
alter table public.scraper_config_history enable row level security;
alter table public.scraper_run_events enable row level security;

drop policy if exists "scraper_config_admin_read" on public.scraper_config;
create policy "scraper_config_admin_read"
  on public.scraper_config for select
  using (public.is_admin());

drop policy if exists "scraper_config_admin_update" on public.scraper_config;
create policy "scraper_config_admin_update"
  on public.scraper_config for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "scraper_config_history_admin_read" on public.scraper_config_history;
create policy "scraper_config_history_admin_read"
  on public.scraper_config_history for select
  using (public.is_admin());

drop policy if exists "scraper_run_events_admin_read" on public.scraper_run_events;
create policy "scraper_run_events_admin_read"
  on public.scraper_run_events for select
  using (public.is_admin());

insert into public.scraper_config (id, settings)
values (
  'default',
  jsonb_build_object(
    'startUrls', jsonb_build_array(),
    'disableWebhooks', true,
    'mapsKeywords', jsonb_build_array('custom closets', 'closet organizers', 'closet design'),
    'targetLocations', jsonb_build_array('Nashville TN'),
    'headless', true,
    'maxConcurrency', 2,
    'maxResultsPerQuery', 25,
    'maxRequestsPerCrawl', 200,
    'webhookBatchSize', 50,
    'pipelineAWebhookUrl', '',
    'pipelineBWebhookUrl', '',
    'webhookAuthHeader', 'Authorization'
  )
)
on conflict (id) do nothing;
