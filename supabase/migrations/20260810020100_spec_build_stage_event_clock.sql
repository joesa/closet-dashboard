-- `now()` is fixed for the lifetime of a PostgreSQL transaction. Use the wall
-- clock for transition events so two status changes in one transaction retain
-- their actual execution order.

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
      to_status,
      occurred_at
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      clock_timestamp()
    );
  END IF;

  RETURN NEW;
END;
$$;