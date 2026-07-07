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

const customRooms = [
  {
    "name": "Residential Roof Replacement",
    "price_basic": 7500,
    "price_premium": 16500,
    "price_standard": 11200
  }
]
const services = ['Roof Repair', 'Roof Replacement']
console.log(mergeCustomRoomsWithServices(customRooms, services))
