-- Enforce the tenant <-> contractor_settings relationship (Phase 3 of
-- data-model reconciliation). Must run AFTER 20260530120000_reconcile_tenant_widget_id.sql,
-- which guarantees every tenants.widget_id points at an existing
-- contractor_settings row.
--
-- This makes the bridge between the two data models explicit and prevents
-- future drift (e.g. a tenant being created with a widget_id that has no
-- pricing/settings row). ON DELETE RESTRICT so a contractor_settings row can't
-- be deleted out from under a live tenant.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_widget_id_fkey'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_widget_id_fkey
      FOREIGN KEY (widget_id)
      REFERENCES public.contractor_settings(id)
      ON DELETE RESTRICT;
  END IF;
END $$;
