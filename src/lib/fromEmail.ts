/**
 * Resend "from" address for platform mail (leads, intake, booking, orders).
 * Requires ditchtheform.com verified on Resend.
 */
export const DEFAULT_FROM_EMAIL = 'DitchTheForm <admin@ditchtheform.com>'

export function platformFromEmail(): string {
  const from = process.env.INTAKE_FROM_EMAIL?.trim()
  return from || DEFAULT_FROM_EMAIL
}
