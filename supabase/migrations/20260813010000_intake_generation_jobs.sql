-- Durable status/result records for every AI generation started during intake.
-- Graphile Worker owns execution; Vercel routes only validate enough to enqueue.
create table if not exists public.intake_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null references public.prospect_intakes(id) on delete cascade,
  operation text not null,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'succeeded', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists intake_generation_jobs_intake_created_idx
  on public.intake_generation_jobs (intake_id, created_at desc);

create index if not exists intake_generation_jobs_status_idx
  on public.intake_generation_jobs (status, created_at);

alter table public.intake_generation_jobs enable row level security;

comment on table public.intake_generation_jobs is
  'Server-only lifecycle and results for intake generation work executed by Graphile Worker.';
