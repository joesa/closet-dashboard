import type { SupabaseClient } from '@supabase/supabase-js';

export type TeardownStep = {
  table: string;
  column: string;
  optional?: boolean;
};

/**
 * Ordered list of tables to clean up when replacing or deleting a tenant.
 * Delete child tables before parent tables to avoid foreign key constraint violations
 * (e.g. service_catalog_contractor_id_fkey on table service_catalog).
 */
export const TEARDOWN_STEPS: TeardownStep[] = [
  { table: 'service_catalog', column: 'contractor_id', optional: true },
  { table: 'service_ux_defaults', column: 'contractor_id', optional: true },
  { table: 'contractor_rooms', column: 'contractor_id', optional: true },
  { table: 'contractor_addons', column: 'contractor_id', optional: true },
  { table: 'contractor_finishes', column: 'contractor_id', optional: true },
  { table: 'site_configs', column: 'tenant_id', optional: true },
  { table: 'domains', column: 'tenant_id', optional: true },
  // tenants.widget_id -> contractor_settings(id): delete tenant before settings
  { table: 'tenants', column: 'id', optional: false },
  { table: 'contractor_settings', column: 'id', optional: false },
];

/**
 * Tears down all rows associated with a tenant ID across all child and parent tables.
 * Safe against foreign key constraint errors during redeploy / re-provisioning.
 */
export async function teardownTenantData(
  supabase: SupabaseClient,
  tenantId: string,
  ownerEmail?: string
): Promise<void> {
  for (const step of TEARDOWN_STEPS) {
    const { error: delErr } = await supabase
      .from(step.table)
      .delete()
      .eq(step.column, tenantId);

    if (delErr) {
      if (step.optional) {
        console.warn(
          `[teardownTenantData] Non-fatal teardown error on optional table ${step.table} for ${tenantId}: ${delErr.message}`
        );
      } else {
        const identifier = ownerEmail || tenantId;
        throw new Error(
          `Failed to tear down ${step.table} for ${identifier}: ${delErr.message}`
        );
      }
    }
  }
}
