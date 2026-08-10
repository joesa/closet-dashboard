-- Durable timing history for the automated Spec Build pipeline.
--
-- The trigger owns this ledger because not every status change goes through
-- transitionSpecBuild: callbacks, admin actions and cron jobs also update the
-- row directly. Existing builds get an honest baseline event at migration
-- time; their earlier stage boundaries cannot be reconstructed accurately.

CREATE TABLE IF NOT EXISTS public.spec_build_stage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spec_build_id UUID NOT NULL REFERENCES public.spec_builds(id) ON DELETE CASCADE,
    from_status spec_build_status,
    to_status spec_build_status NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_spec_build_stage_events_build_time
    ON public.spec_build_stage_events (spec_build_id, occurred_at, id);

ALTER TABLE public.spec_build_stage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spec_build_stage_events_service_role" ON public.spec_build_stage_events;
CREATE POLICY "spec_build_stage_events_service_role"
    ON public.spec_build_stage_events FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.record_spec_build_stage_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.spec_build_stage_events (
      spec_build_id,
      from_status,
      to_status,
      metadata,
      occurred_at
    ) VALUES (
      NEW.id,
      NULL,
      NEW.status,
      jsonb_build_object('initial', true),
      NEW.created_at
    );
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.spec_build_stage_events (
      spec_build_id,
      from_status,
      to_status
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS spec_build_stage_event_trigger ON public.spec_builds;
CREATE TRIGGER spec_build_stage_event_trigger
AFTER INSERT OR UPDATE OF status ON public.spec_builds
FOR EACH ROW
EXECUTE FUNCTION public.record_spec_build_stage_event();

INSERT INTO public.spec_build_stage_events (
  spec_build_id,
  from_status,
  to_status,
  metadata,
  occurred_at
)
SELECT
  build.id,
  NULL,
  build.status,
  jsonb_build_object('baseline', true),
  timezone('utc'::text, now())
FROM public.spec_builds AS build
WHERE NOT EXISTS (
  SELECT 1
  FROM public.spec_build_stage_events AS event
  WHERE event.spec_build_id = build.id
);

COMMENT ON TABLE public.spec_build_stage_events IS
  'Immutable status transition ledger used for Spec Build progress and timing.';
