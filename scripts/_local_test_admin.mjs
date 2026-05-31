// TEMP local-test helper: create/refresh a temporary admin user in the shared
// Supabase project so we can drive the admin UI end-to-end. Deleted during cleanup.
// Usage: set -a; . ./.env.local; set +a; node scripts/_local_test_admin.mjs <create|delete>
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const EMAIL = 'local-test-admin@closetquotes.com';
const PASSWORD = 'LocalTest!2026-cq';
const action = process.argv[2] || 'create';

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function findUser() {
  // listUsers is paginated; scan for our email.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === EMAIL);
    if (u) return u;
    if (data.users.length < 200) break;
  }
  return null;
}

if (action === 'create') {
  let user = await findUser();
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    user = data.user;
    console.log('created auth user', user.id);
  } else {
    await supabase.auth.admin.updateUserById(user.id, { password: PASSWORD });
    console.log('reused auth user', user.id);
  }
  const { error: pErr } = await supabase
    .from('profiles')
    .upsert({ id: user.id, email: EMAIL, is_admin: true }, { onConflict: 'id' });
  if (pErr) throw pErr;
  console.log('OK admin ready');
  console.log('EMAIL=' + EMAIL);
  console.log('PASSWORD=' + PASSWORD);
} else if (action === 'delete') {
  const user = await findUser();
  if (!user) {
    console.log('no test admin to delete');
    process.exit(0);
  }
  await supabase.from('profiles').delete().eq('id', user.id);
  const { error } = await supabase.auth.admin.deleteUser(user.id);
  if (error) throw error;
  console.log('deleted test admin', user.id);
}
