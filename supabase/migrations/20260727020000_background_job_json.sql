-- Graphile Worker job status for intake studio + admin image batches.
-- Full redesign continues to use site_configs.custom_build_job.

alter table public.prospect_intakes
  add column if not exists background_job jsonb;

comment on column public.prospect_intakes.background_job is
  'Graphile Worker status for async intake generate-site / generate-images ({ task, status, ... }).';

alter table public.site_configs
  add column if not exists background_job jsonb;

comment on column public.site_configs.background_job is
  'Graphile Worker status for async admin image jobs ({ task, jobKey, status, ... }).';
