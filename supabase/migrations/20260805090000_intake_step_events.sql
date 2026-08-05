-- Step-level intake funnel telemetry: which step a prospect entered/completed,
-- so drop-off points are measurable instead of guessed. Written best-effort by
-- the app via the service role; no public access.
create table if not exists public.intake_step_events (
  id uuid primary key default gen_random_uuid(),
  token text not null,
  step_key text not null,
  action text not null default 'enter',
  created_at timestamptz not null default now()
);

create index if not exists intake_step_events_token_idx
  on public.intake_step_events (token, created_at);

create index if not exists intake_step_events_step_idx
  on public.intake_step_events (step_key, action, created_at);

alter table public.intake_step_events enable row level security;
-- No policies on purpose: only the service role writes/reads this table.
