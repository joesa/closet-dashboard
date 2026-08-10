-- Timestamps can tie even with clock_timestamp(). Give every event a monotonic
-- database order so rapid transitions in one transaction remain deterministic.

ALTER TABLE public.spec_build_stage_events
  ADD COLUMN IF NOT EXISTS event_order BIGINT GENERATED ALWAYS AS IDENTITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_spec_build_stage_events_order
  ON public.spec_build_stage_events (event_order);

CREATE INDEX IF NOT EXISTS idx_spec_build_stage_events_build_order
  ON public.spec_build_stage_events (spec_build_id, event_order);
