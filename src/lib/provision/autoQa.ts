export type AutoQaResult = { passed: boolean; reasons: string[] }

export function runAutoQaChecks(opts: {
  businessName: string
  contactEmail: string | null
  services: string[] | null
  subdomain: string
}): AutoQaResult {
  const reasons: string[] = []
  if (!opts.businessName?.trim()) reasons.push('missing business name')
  if (!opts.contactEmail?.trim()) reasons.push('missing contact email')
  if (!opts.services?.length) reasons.push('no services')
  if (!opts.subdomain?.trim()) reasons.push('missing subdomain')
  return { passed: reasons.length === 0, reasons }
}

// maybeAutoApproveTenant lived here behind AUTO_APPROVE_PROVISION_JOBS. It is
// superseded by src/lib/launch/autoLaunch.ts, which is unconditional, runs the
// first Full redesign before revealing the site, and — unlike the old bypass —
// actually respects tenants.validation_status.
