import { Resend } from 'resend'

const FROM =
  process.env.INTAKE_FROM_EMAIL || 'ClosetQuote <admin@closetquotes.com>'

export async function sendIntakeLinkEmail(opts: {
  to: string
  businessName?: string | null
  intakeUrl: string
  verifyUrl?: string
  /** Verify + preselect Standard, then go straight to the form (no deposit). */
  verifyStandardUrl?: string
  /** Verify + preselect AI Premium, then go straight to Stripe checkout for the deposit. */
  verifyPremiumUrl?: string
  standardTotalLabel?: string
  premiumTotalLabel?: string
  premiumDepositLabel?: string
  premiumRemainderLabel?: string
}) {
  if (!process.env.RESEND_API_KEY) return

  const resend = new Resend(process.env.RESEND_API_KEY)
  const who = opts.businessName?.trim() || 'your business'

  const hasTierChoice = !!(opts.verifyStandardUrl && opts.verifyPremiumUrl)

  const tierBlock = hasTierChoice
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-collapse:separate;border-spacing:8px 0;">
        <tr>
          <td style="width:50%;padding:16px;border:1px solid #e5e5e5;border-radius:8px;vertical-align:top;">
            <p style="margin:0 0 4px;font-weight:600;">Standard${opts.standardTotalLabel ? ` — ${opts.standardTotalLabel}` : ''}</p>
            <p style="margin:0 0 12px;font-size:13px;color:#555;">
              One-time build fee. <strong>No deposit required.</strong> Professional stock photography.
            </p>
            <a href="${opts.verifyStandardUrl}" style="display:inline-block;background:#111827;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-size:14px;">Start with Standard →</a>
          </td>
          <td style="width:50%;padding:16px;border:1px solid #6366f1;border-radius:8px;vertical-align:top;">
            <p style="margin:0 0 4px;font-weight:600;">AI Premium${opts.premiumTotalLabel ? ` — ${opts.premiumTotalLabel}` : ''}</p>
            <p style="margin:0 0 12px;font-size:13px;color:#555;">
              Custom AI-generated photos with the AI image studio.
              ${opts.premiumDepositLabel ? ` ${opts.premiumDepositLabel} (30%) is due today to unlock it.` : ''}
              ${opts.premiumRemainderLabel ? ` The remaining ${opts.premiumRemainderLabel} is only due once you're happy with the preview, before launch.` : ''}
            </p>
            <a href="${opts.verifyPremiumUrl}" style="display:inline-block;background:#6366f1;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-size:14px;">Pay ${opts.premiumDepositLabel || 'deposit'} &amp; start AI Premium →</a>
          </td>
        </tr>
      </table>
      <p style="font-size:13px;color:#777;">
        Not sure yet? <a href="${opts.verifyUrl}">Open the form</a> and decide there — Standard never requires a deposit, so you can always switch to it if you'd rather not pay upfront for AI Premium.
      </p>
    `
    : opts.verifyUrl
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
      ${tierBlock}
      <p>If you did not request this, you can ignore this email.</p>
    `,
  })
}

