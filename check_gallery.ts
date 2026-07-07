import { getSupabaseAdmin } from './src/lib/supabase-admin';
async function run() {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('prospect_intakes').select('business_name, gallery_images, requested_pages').order('created_at', { ascending: false }).limit(5);
  console.log(JSON.stringify(data, null, 2));
}
run();
