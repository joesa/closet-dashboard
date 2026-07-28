import type { IndustrySlug } from '@/lib/catalog/types'
import { matchServiceDef } from '@/lib/catalog/serviceCatalog'
import {
  sanitizeLucideIcon,
  type LucideIconKey,
} from '@/lib/catalog/lucideIconAllowlist'

/** Materials-heavy trades — package step shows finish/material swatches. */
const MATERIALS_INDUSTRIES = new Set<string>([
  'auto-body',
  'painting',
  'cabinet-painting',
  'custom-closets',
  'flooring',
  'epoxy-flooring',
  'countertops',
  'siding',
  'remodeling',
  'carpentry',
  'concrete-masonry',
  'deck-maintenance',
])

/** Diagnostic / repair / booking-style — skip package step (auto standard). */
const SKIP_PACKAGE_KEYWORDS =
  /repair|diagnostic|inspection|emergency|service call|tune.?up|maintenance|towing|roadside|leak detection|drain clean/i

const ICON_BY_KEYWORD: Array<{ re: RegExp; icon: LucideIconKey }> = [
  { re: /wrap|vinyl|paint|detail|ceramic/i, icon: 'SprayCan' },
  { re: /collision|body|dent|bumper|frame/i, icon: 'Car' },
  { re: /glass|windshield/i, icon: 'Glasses' },
  { re: /plumb|drain|pipe|water heater|sewer|faucet|fixture/i, icon: 'Droplets' },
  { re: /hvac|furnace|ac |air condition|heat pump|duct/i, icon: 'Wind' },
  { re: /electric|panel|outlet|wiring|ev charger|lighting/i, icon: 'Zap' },
  { re: /roof|shingle|gutter|skylight/i, icon: 'Home' },
  { re: /clean|carpet|window wash/i, icon: 'Sparkles' },
  { re: /lawn|landscape|mulch|tree|shrub|sod/i, icon: 'Leaf' },
  { re: /tow|roadside|winch|flatbed/i, icon: 'Truck' },
  { re: /floor|epoxy|tile/i, icon: 'Layers' },
  { re: /closet|cabinet|storage/i, icon: 'DoorOpen' },
  { re: /pest|bug/i, icon: 'Bug' },
  { re: /lock|key/i, icon: 'Key' },
  { re: /paint/i, icon: 'Paintbrush' },
  { re: /fence/i, icon: 'Fence' },
  { re: /pool|spa|water/i, icon: 'Waves' },
]

export type ServiceUxDefaults = {
  icon: LucideIconKey
  requiresPackage: boolean
  requiresMaterials: boolean
}

export function getServiceUxDefaults(
  serviceName: string,
  industrySlug?: IndustrySlug
): ServiceUxDefaults {
  const def = matchServiceDef(serviceName, industrySlug)
  const industry = industrySlug || def?.industry
  const label = def?.label || serviceName
  const materials =
    !!industry && MATERIALS_INDUSTRIES.has(industry)
      ? true
      : /wrap|paint|floor|closet|cabinet|melamine|vinyl|coating|finish/i.test(label)

  const skipPackage =
    SKIP_PACKAGE_KEYWORDS.test(label) &&
    !/wrap|paint|floor|closet|remodel/i.test(label)

  let icon: LucideIconKey = 'Package'
  for (const { re, icon: ic } of ICON_BY_KEYWORD) {
    if (re.test(label)) {
      icon = ic
      break
    }
  }

  return {
    icon: sanitizeLucideIcon(icon),
    requiresPackage: !skipPackage,
    requiresMaterials: materials && !skipPackage,
  }
}
