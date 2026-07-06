const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const { data: domainData } = await supabase.from('domains').select('tenant_id').eq('hostname', 'yaweg-food-truck-service.localhost').single();
  if (!domainData) {
    console.log("Domain not found!");
    return;
  }
  
  const tenantId = domainData.tenant_id;
  console.log("Tenant ID:", tenantId);

  // 1. Fetch current contractor_rooms for this tenant
  const { data: rooms } = await supabase.from('contractor_rooms').select('*').eq('contractor_id', tenantId);
  console.log(`Found ${rooms?.length || 0} contractor_rooms`);

  if (rooms && rooms.length > 0) {
    // 2. Map them to menu_items
    const menuItems = rooms.map((r, i) => ({
      contractor_id: tenantId,
      name: r.name,
      price: r.price_standard || r.price_basic || 10,
      category: 'Menu',
      sort_order: i
    }));

    // 3. Insert into menu_items
    const { error: insertError } = await supabase.from('menu_items').insert(menuItems);
    if (insertError) {
      console.error("Error inserting menu_items:", insertError);
      return;
    }
    console.log(`Successfully migrated ${menuItems.length} to menu_items.`);

    // 4. Delete the stale contractor_rooms
    const { error: deleteError } = await supabase.from('contractor_rooms').delete().eq('contractor_id', tenantId);
    if (deleteError) {
      console.error("Error deleting contractor_rooms:", deleteError);
    } else {
      console.log("Successfully deleted old contractor_rooms.");
    }
  } else {
    console.log("No contractor_rooms found to migrate. Maybe already migrated?");
  }
}
run();
