import { Resend } from 'resend'
import { formatUsd } from '@/lib/intake/tiers'

const FROM =
  process.env.INTAKE_FROM_EMAIL || 'ClosetQuote <admin@closetquotes.com>'

export async function sendIntakeLaunchPaymentEmail(opts: {
  to: string
  businessName?: string | null
  intakeUrl: string
  amountLabel: string
  amountCents: number
}) {
  if (!process.env.RESEND_API_KEY) return

  const resend = new Resend(process.env.RESEND_API_KEY)
  const who = opts.businessName?.trim() || 'your business'

  await resend.emails.send({
    from: FROM,
    to: [opts.to],
    subject: `${who} — your site is ready to launch`,
    html: `
      <h1>Ready to launch</h1>
      <p>Your ClosetQuote site preview has been approved. When you're satisfied, pay ${formatUsd(opts.amountCents)} to launch and get full dashboard access.</p>
      <p><a href="${opts.intakeUrl}">Pay and launch</a></p>
      <p>If you have questions, reply to this email.</p>
    `,
  })
}
