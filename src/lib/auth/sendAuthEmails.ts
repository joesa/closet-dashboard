import { Resend } from 'resend'
import { platformFromEmail } from '@/lib/fromEmail'
import { publicAppOrigin } from '@/lib/urls'

function appOrigin(): string {
  return publicAppOrigin()
}

async function send(opts: {
  to: string
  subject: string
  html: string
}): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[sendAuthEmails] RESEND_API_KEY missing — skipping send')
    return
  }
  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: platformFromEmail(),
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
  })
}

export async function sendPasswordVerifyEmail(opts: {
  to: string
  token: string
}): Promise<void> {
  const url = `${appOrigin()}/auth/password/verify?token=${encodeURIComponent(opts.token)}`
  await send({
    to: opts.to,
    subject: 'Verify your identity to reset your password',
    html: `
      <h1>Password reset — step 1 of 2</h1>
      <p>We received a request to reset your DitchTheForm dashboard password.</p>
      <p>Click below to verify this is you. We will then send a second email with a link to choose a new password.</p>
      <p><a href="${url}" style="display:inline-block;background:#111;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;">Verify identity</a></p>
      <p style="color:#666;font-size:13px;">If you did not request this, you can ignore this email.</p>
      <p style="color:#666;font-size:12px;">Link: ${url}</p>
    `,
  })
}

export async function sendPasswordResetEmail(opts: {
  to: string
  token: string
}): Promise<void> {
  const url = `${appOrigin()}/auth/password/reset?token=${encodeURIComponent(opts.token)}`
  await send({
    to: opts.to,
    subject: 'Choose a new password',
    html: `
      <h1>Password reset — step 2 of 2</h1>
      <p>Your identity was verified. Use the link below to set a new password. You will not need your old password.</p>
      <p><a href="${url}" style="display:inline-block;background:#111;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;">Set new password</a></p>
      <p style="color:#666;font-size:13px;">This link expires soon. If you did not request a reset, ignore this email.</p>
      <p style="color:#666;font-size:12px;">Link: ${url}</p>
    `,
  })
}

export async function sendEmailChangeConfirmOldEmail(opts: {
  to: string
  token: string
}): Promise<void> {
  const url = `${appOrigin()}/auth/email-change/confirm?token=${encodeURIComponent(opts.token)}`
  await send({
    to: opts.to,
    subject: 'Confirm your email change request',
    html: `
      <h1>Confirm email change</h1>
      <p>Someone requested to change the login email for your DitchTheForm dashboard.</p>
      <p>Click below to confirm this request and enter the new email address. An admin will review before the change is activated.</p>
      <p><a href="${url}" style="display:inline-block;background:#111;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;">Continue email change</a></p>
      <p style="color:#666;font-size:13px;">If you did not request this, ignore this email.</p>
    `,
  })
}

export async function sendEmailChangeAckOldEmail(opts: {
  to: string
  token: string
  newEmail: string
}): Promise<void> {
  const url = `${appOrigin()}/auth/email-change/ack?token=${encodeURIComponent(opts.token)}`
  await send({
    to: opts.to,
    subject: 'Confirm login with your new email',
    html: `
      <h1>Confirm your new login email</h1>
      <p>An admin approved changing your dashboard login to <strong>${opts.newEmail}</strong>.</p>
      <p>Click below to confirm you still control this previous inbox. After that, you can sign in with the new email.</p>
      <p><a href="${url}" style="display:inline-block;background:#111;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;">Confirm and activate</a></p>
      <p style="color:#666;font-size:13px;">If you did not expect this, contact support.</p>
    `,
  })
}
