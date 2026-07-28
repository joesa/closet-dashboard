/**
 * Lucide icon keys the AI / provision path may assign to contractor_rooms.icon.
 * Widget maps these to lucide-react components; unknown keys fall back to Package.
 */
export const LUCIDE_ICON_ALLOWLIST = [
  'Package',
  'Wrench',
  'Hammer',
  'Paintbrush',
  'Droplets',
  'Flame',
  'Zap',
  'Car',
  'Truck',
  'Sparkles',
  'SprayCan',
  'Home',
  'Building2',
  'TreePine',
  'Leaf',
  'Shovel',
  'Ruler',
  'Layers',
  'Square',
  'Grid3x3',
  'DoorOpen',
  'Bath',
  'CookingPot',
  'Wind',
  'Thermometer',
  'Snowflake',
  'Sun',
  'CloudRain',
  'Shield',
  'Lock',
  'Key',
  'Lightbulb',
  'Plug',
  'Cable',
  'Glasses',
  'Scan',
  'Bug',
  'Trash2',
  'Move',
  'Fence',
  'Mountain',
  'Waves',
  'Droplet',
  'HardHat',
  'ClipboardList',
  'Calendar',
  'Clock',
  'Star',
  'Heart',
  'Scissors',
  'Stethoscope',
  'Bone',
  'PawPrint',
  'Music',
  'Camera',
  'Monitor',
  'Smartphone',
  'Wifi',
  'Settings',
] as const

export type LucideIconKey = (typeof LUCIDE_ICON_ALLOWLIST)[number]

const ALLOW_SET = new Set<string>(LUCIDE_ICON_ALLOWLIST)

export function isAllowedLucideIcon(name: string | null | undefined): name is LucideIconKey {
  return !!name && ALLOW_SET.has(name)
}

export function sanitizeLucideIcon(
  name: string | null | undefined,
  fallback: LucideIconKey = 'Package'
): LucideIconKey {
  return isAllowedLucideIcon(name) ? name : fallback
}
