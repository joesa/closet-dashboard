-- Native booking/ticket tables were originally created without RLS. Public
-- reads and customer writes are mediated by allowlisted server routes; signed-in
-- contractors may manage only rows belonging to their contractor_settings row.

ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_orders ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
  public.service_catalog,
  public.booking_availability,
  public.bookings,
  public.ticket_events,
  public.ticket_orders
FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.service_catalog,
  public.booking_availability,
  public.ticket_events
TO authenticated;

GRANT SELECT, UPDATE, DELETE ON TABLE
  public.bookings,
  public.ticket_orders
TO authenticated;

GRANT ALL PRIVILEGES ON TABLE
  public.service_catalog,
  public.booking_availability,
  public.bookings,
  public.ticket_events,
  public.ticket_orders
TO service_role;

DROP POLICY IF EXISTS service_catalog_owner_all ON public.service_catalog;
CREATE POLICY service_catalog_owner_all ON public.service_catalog
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contractor_settings cs
      WHERE cs.id = service_catalog.contractor_id
        AND cs.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contractor_settings cs
      WHERE cs.id = service_catalog.contractor_id
        AND cs.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS booking_availability_owner_all ON public.booking_availability;
CREATE POLICY booking_availability_owner_all ON public.booking_availability
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contractor_settings cs
      WHERE cs.id = booking_availability.contractor_id
        AND cs.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contractor_settings cs
      WHERE cs.id = booking_availability.contractor_id
        AND cs.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS ticket_events_owner_all ON public.ticket_events;
CREATE POLICY ticket_events_owner_all ON public.ticket_events
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contractor_settings cs
      WHERE cs.id = ticket_events.contractor_id
        AND cs.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contractor_settings cs
      WHERE cs.id = ticket_events.contractor_id
        AND cs.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS bookings_owner_read ON public.bookings;
CREATE POLICY bookings_owner_read ON public.bookings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contractor_settings cs
      WHERE cs.id = bookings.contractor_id
        AND cs.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS bookings_owner_update ON public.bookings;
CREATE POLICY bookings_owner_update ON public.bookings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contractor_settings cs
      WHERE cs.id = bookings.contractor_id
        AND cs.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contractor_settings cs
      WHERE cs.id = bookings.contractor_id
        AND cs.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS bookings_owner_delete ON public.bookings;
CREATE POLICY bookings_owner_delete ON public.bookings
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contractor_settings cs
      WHERE cs.id = bookings.contractor_id
        AND cs.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS ticket_orders_owner_read ON public.ticket_orders;
CREATE POLICY ticket_orders_owner_read ON public.ticket_orders
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contractor_settings cs
      WHERE cs.id = ticket_orders.contractor_id
        AND cs.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS ticket_orders_owner_update ON public.ticket_orders;
CREATE POLICY ticket_orders_owner_update ON public.ticket_orders
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contractor_settings cs
      WHERE cs.id = ticket_orders.contractor_id
        AND cs.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contractor_settings cs
      WHERE cs.id = ticket_orders.contractor_id
        AND cs.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS ticket_orders_owner_delete ON public.ticket_orders;
CREATE POLICY ticket_orders_owner_delete ON public.ticket_orders
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.contractor_settings cs
      WHERE cs.id = ticket_orders.contractor_id
        AND cs.user_id = (SELECT auth.uid())
    )
  );