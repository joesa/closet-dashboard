import { getSupabaseAdmin } from '../src/lib/supabase-admin';

async function seed() {
  const supabase = getSupabaseAdmin();
  const tenantId = 'd37ad799-1c89-423f-8a4f-56e9a46588a2';

  console.log('Seeding menu items...');
  const { error } = await supabase.from('menu_items').insert([
    { contractor_id: tenantId, name: 'Classic Cheeseburger', price: 12.99, category: 'Burgers', sort_order: 0 },
    { contractor_id: tenantId, name: 'Truffle Fries', price: 6.99, category: 'Sides', sort_order: 1 },
    { contractor_id: tenantId, name: 'Vanilla Shake', price: 5.50, category: 'Drinks', sort_order: 2 }
  ]);

  if (error) {
    console.error('Error seeding:', error);
  } else {
    console.log('Done!');
  }
}

seed().catch(console.error);
