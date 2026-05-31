import { Resend } from 'resend'

const FROM =
  process.env.INTAKE_FROM_EMAIL || 'ClosetQuote <admin@closetquotes.com>'

export async function sendIntakeLinkEmail(opts: {
  to: string
  businessName?: string | null
  intakeUrl: string
  verifyUrl?: string
}) {
  if (!process.env.RESEND_API_KEY) return

  const resend = new Resend(process.env.RESEND_API_KEY)
  const who = opts.businessName?.trim() || 'your business'

  const verifyBlock = opts.verifyUrl
    ? `<p><a href="${opts.verifyUrl}">Verify your email and continue</a> (required before submitting).</p>
       <p>Or open the intake form directly: <a href="${opts.intakeUrl}">${opts.intakeUrl}</a></p>`
    : `<p><a href="${opts.intakeUrl}">Complete your setup form</a></p>`

  await resend.emails.send({
    from: FROM,
    to: [opts.to],
    subject: `Complete your ClosetQuote setup for ${who}`,
    html: `
      <h1>ClosetQuote setup</h1>
      <p>We need a few details to build your quote calculator${opts.verifyUrl ? ' and website' : ''}.</p>
      ${verifyBlock}
      <p>If you did not request this, you can ignore this email.</p>
    `,
  })
}
