import { sendEmail } from '@/lib/email/send'
import { formatUsd } from '@/lib/intake/tiers'

export async function sendIntakeLaunchPaymentEmail(opts: {
  to: string
  businessName?: string | null
  intakeUrl: string
  amountLabel: string
  amountCents: number
}) {
  if (!process.env.RESEND_API_KEY) return
  const who = opts.businessName?.trim() || 'your business'

  await sendEmail({
    kind: 'intake.launch_payment',
    to: opts.to,
    subject: `${who} — your site is ready to launch`,
    html: `
      <h1>Ready to launch</h1>
      <p>Your DitchTheForm site preview has been approved. When you're satisfied, pay ${formatUsd(opts.amountCents)} to launch and get full dashboard access.</p>
      <p><a href="${opts.intakeUrl}">Pay and launch</a></p>
      <p>If you have questions, reply to this email.</p>
    `,
  })
}
