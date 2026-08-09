import { normalizePhone } from '@/lib/twilio-sms'

/**
 * The strongest guard against texting a real business by accident.
 *
 * `SPEC_BUILD_SMS_ALLOWLIST` is a comma-separated list of E.164 numbers. While
 * it is set, no other number can be messaged, whatever the rest of the pipeline
 * decides — so the first weeks of this feature can run end to end against your
 * own phone with the real cron, the real templates and the real data.
 *
 * Checked BEFORE suppression, cap and window, because those answer "should we
 * send this now" while this answers "are we allowed to send to this person at
 * all". Empty means no restriction, which is why it must be set deliberately
 * before the first real send and removed just as deliberately.
 */
export function specSmsAllowlist(): string[] {
  return (process.env.SPEC_BUILD_SMS_ALLOWLIST || '')
    .split(',')
    .map((entry) => normalizePhone(entry.trim()) || '')
    .filter(Boolean)
}

export function specSmsAllowed(phone: string): boolean {
  const allowlist = specSmsAllowlist()
  if (allowlist.length === 0) return true
  const normalized = normalizePhone(phone)
  return !!normalized && allowlist.includes(normalized)
}
