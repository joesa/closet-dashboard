-- Tracks scraper webhook events sent to Instantly campaign sync endpoint.
-- Used for idempotency, auditability, and replay safety.

create table if not exists public.instantly_sync_events (
  event_key text primary key,
  run_id text not null,
  pipeline text not null,
  batch_index integer not null,
  total_batches integer not null,
  status text not null default 'pending',
  payload jsonb not null,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_instantly_sync_events_run_id
  on public.instantly_sync_events (run_id);

create index if not exists idx_instantly_sync_events_status
  on public.instantly_sync_events (status);

alter table public.instantly_sync_events enable row level security;

-- Admins can read rows for troubleshooting in dashboard tooling.
drop policy if exists "instant_sync_admin_read" on public.instantly_sync_events;
create policy "instant_sync_admin_read"
  on public.instantly_sync_events for select
  using (public.is_admin());
