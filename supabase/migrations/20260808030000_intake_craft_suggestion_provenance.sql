alter table public.prospect_intakes
  add column if not exists craft_suggested_values jsonb not null default '{}'::jsonb;
