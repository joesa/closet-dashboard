-- Allow admins to waive ongoing site maintenance fees (and later undo that waiver).

ALTER TABLE public.prospect_intakes
  ADD COLUMN IF NOT EXISTS maintenance_waived_at timestamptz;

COMMENT ON COLUMN public.prospect_intakes.maintenance_waived_at IS
  'When set, monthly/yearly site maintenance is not required for this intake. Cleared if the waiver is undone.';
