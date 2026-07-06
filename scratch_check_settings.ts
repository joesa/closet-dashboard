import { createClient } from '@supabase/supabase-js'

const url = "https://vtlvqatzsolycqzeknru.supabase.co"
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0bHZxYXR6c29seWNxemVrbnJ1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQzMzE0MSwiZXhwIjoyMDgwMDA5MTQxfQ.Qw8beouOSnSGcMylgcw5lObNf-_qG1-NcTG6xgvwV3Y"
const supabase = createClient(url, key)

async function check() {
  const { data, error } = await supabase
    .from('contractor_settings')
    .select('*')
    .eq('contact_email', 'apex.plumbing.test.90001@example.com')
    .single()
  console.log('Contractor Settings:', JSON.stringify(data, null, 2))
  if (error) console.error('Error:', error)
}
check()
