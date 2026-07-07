import { createClient } from '@supabase/supabase-js'
const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const tenantId = '8c8b432a-5d7c-409b-9301-96baf024cee6'

const { data: intake } = await supa.from('prospect_intakes').select('ai_site_config, services').eq('business_name', 'cihobi6601 Roofing').single()
const aiWidgetConfig = intake.ai_site_config?.widgetConfig ?? null;
const services = intake.services;

function mergeCustomRoomsWithServices(customRooms, services) {
  const existingNames = new Set(customRooms.map((r) => r.name.toLowerCase().trim()))
  const missing = (services || []).filter(
    (s) => s.trim() && !existingNames.has(s.toLowerCase().trim())
  )
  if (missing.length === 0) return customRooms
  const avg = (key) => {
    const values = customRooms
      .map((r) => r[key])
      .filter((v) => typeof v === 'number' && v > 0)
    if (values.length === 0) return 0
    return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length)
  }
  const defaults = { basic: avg('basic'), standard: avg('standard'), premium: avg('premium') }
  return [...customRooms, ...missing.map((name) => ({ name, ...defaults }))]
}

const mergedCustomRooms = mergeCustomRoomsWithServices(aiWidgetConfig?.customRooms || [], services);

// Delete old rooms
await supa.from('contractor_rooms').delete().eq('contractor_id', tenantId)

// Insert new rooms
const { data, error } = await supa.from('contractor_rooms').insert(
  mergedCustomRooms.map((r) => ({
    contractor_id: tenantId,
    name: r.name,
    price_basic: r.basic || 0,
    price_standard: r.standard || 0,
    price_premium: r.premium || 0,
  }))
)
console.log("Updated rooms:", mergedCustomRooms.length, "Error:", error)
