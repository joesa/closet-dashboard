import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: users, error } = await supabase.auth.admin.listUsers();
  const testUser = users?.users.find(u => u.email === 'testadmin@example.com');
  if (!testUser) {
    const { data: newUser } = await supabase.auth.admin.createUser({
      email: 'testadmin@example.com',
      password: 'password123',
      email_confirm: true
    });
    console.log('Created testadmin@example.com');
    if (newUser.user) {
      await supabase.from('profiles').update({ is_admin: true }).eq('id', newUser.user.id);
      console.log('Made testadmin@example.com admin');
    }
  } else {
    await supabase.from('profiles').update({ is_admin: true }).eq('id', testUser.id);
    await supabase.auth.admin.updateUserById(testUser.id, { password: 'password123' });
    console.log('Updated testadmin@example.com password and admin status');
  }
}
main();
