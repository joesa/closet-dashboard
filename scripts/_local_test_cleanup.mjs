// One-off cleanup for local E2E test data in shared Supabase.
// Usage: set -a; . ./.env.local; set +a; node scripts/_local_test_cleanup.mjs
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const TENANT_ID = 'f7901bb4-bed4-4086-ba78-cc226adbcfd7';
const INTAKE_ID = 'f6f6ff39-f7e3-4001-a0de-a07e3cf94696';
const TEST_ADMIN_EMAIL = 'local-test-admin@closetquotes.com';

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function findTestAdmin() {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === TEST_ADMIN_EMAIL);
    if (u) return u;
    if (data.users.length < 200) break;
  }
  return null;
}

async function deleteTenant(tenantId) {
  // Widget/catalog rows keyed by contractor_settings.id (= tenant id).
  for (const table of ['contractor_rooms', 'contractor_addons', 'contractor_finishes']) {
    const { error } = await supabase.from(table).delete().eq('contractor_id', tenantId);
    if (error) console.warn(`  ${table}:`, error.message);
  }
  for (const table of ['leads', 'quote_events']) {
    const { error } = await supabase.from(table).delete().eq('contractor_id', tenantId);
    if (error) console.warn(`  ${table}:`, error.message);
  }
  await supabase.from('site_configs').delete().eq('tenant_id', tenantId);
  await supabase.from('domains').delete().eq('tenant_id', tenantId);
  // Tenant.widget_id FK → contractor_settings; delete tenant before settings row.
  const { error: tErr } = await supabase.from('tenants').delete().eq('id', tenantId);
  if (tErr) throw tErr;
  const { error: csErr } = await supabase.from('contractor_settings').delete().eq('id', tenantId);
  if (csErr) throw csErr;
}

async function main() {
  console.log('Deleting prospect intake', INTAKE_ID);
  const { error: intakeErr } = await supabase.from('prospect_intakes').delete().eq('id', INTAKE_ID);
  if (intakeErr) throw intakeErr;

  console.log('Deleting tenant + related rows', TENANT_ID);
  await deleteTenant(TENANT_ID);

  console.log('Deleting test admin', TEST_ADMIN_EMAIL);
  const admin = await findTestAdmin();
  if (admin) {
    await supabase.from('profiles').delete().eq('id', admin.id);
    const { error } = await supabase.auth.admin.deleteUser(admin.id);
    if (error) throw error;
    console.log('  deleted auth user', admin.id);
  } else {
    console.log('  no test admin found (already removed)');
  }

  console.log('OK — local test data removed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
