ALTER TABLE public.prospect_intakes
  ADD COLUMN IF NOT EXISTS other_services text;
