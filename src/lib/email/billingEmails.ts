import { renderEmail } from '@/lib/email/layout'
import { sendEmail } from '@/lib/email/send'
import { PAST_DUE_GRACE_DAYS } from '@/lib/entitlement'
import { publicAppOrigin } from '@/lib/urls'

/**
 * The billing messages that did not exist.
 *
 * Before this, a customer whose card failed learned about it when their own
 * website's quote form stopped working. There was no dunning email, no trial
 * warning, and no cancellation notice anywhere in the codebase — involuntary
 * churn was simply unrecovered.
 *
 * Every send is idempotency-keyed so the cron that drives them can run as often
 * as it likes without turning a reminder into harassment.
 */

const billingUrl = () => `${publicAppOrigin()}/billing`

function daysWord(n: number): string {
  return n === 1 ? '1 day' : `${n} days`
}

/** Card failed. Sent on the failure, then again as the window closes. */
export async function sendPaymentFailedEmail(opts: {
  to: string
  contractorId: string
  companyName?: string | null
  attempt: 1 | 2 | 3
  daysLeft: number
  /** Identifies the billing period, so a new failure can mail again. */
  periodKey: string
}) {
  const who = opts.companyName?.trim() || 'your account'
  const urgent = opts.attempt >= 2

  return sendEmail({
    kind: 'billing.payment_failed',
    to: opts.to,
    contractorId: opts.contractorId,
    idempotencyKey: `billing.payment_failed:${opts.contractorId}:${opts.periodKey}:${opts.attempt}`,
    subject: urgent
      ? `Action needed: ${who} — your quote calculator stops in ${daysWord(opts.daysLeft)}`
      : `We couldn't process your payment for ${who}`,
    html: renderEmail({
      heading: urgent ? 'Your calculator stops soon' : "We couldn't process your payment",
      blocks: [
        {
          type: 'text',
          text: `The card on file for ${who} was declined. Nothing has changed yet — your quote calculator is still live on your website and still capturing leads.`,
        },
        {
          type: 'text',
          text:
            opts.daysLeft > 0
              ? `You have ${daysWord(opts.daysLeft)} to update it. After that the calculator stops accepting new quotes until payment goes through.`
              : 'This is the last reminder before the calculator stops accepting new quotes.',
        },
        { type: 'button', label: 'Update your card', href: billingUrl() },
        {
          type: 'note',
          text: 'If you have already updated it, no action is needed — this email may have crossed with your payment.',
        },
      ],
    }),
  })
}

/** The trial is ending. Sent once, a few days out. */
export async function sendTrialEndingEmail(opts: {
  to: string
  contractorId: string
  companyName?: string | null
  daysLeft: number
  trialEndsAt: string
}) {
  const who = opts.companyName?.trim() || 'your account'
  return sendEmail({
    kind: 'billing.trial_ending',
    to: opts.to,
    contractorId: opts.contractorId,
    idempotencyKey: `billing.trial_ending:${opts.contractorId}:${opts.trialEndsAt}`,
    subject: `${who} — your free trial ends in ${daysWord(opts.daysLeft)}`,
    html: renderEmail({
      heading: `Your trial ends in ${daysWord(opts.daysLeft)}`,
      blocks: [
        {
          type: 'text',
          text: `When the trial ends, the quote calculator on your website stops accepting new quotes. Adding a card keeps it running — nothing else changes.`,
        },
        { type: 'button', label: 'Keep my calculator running', href: billingUrl() },
      ],
    }),
  })
}

/** Access has actually stopped. Says plainly what broke and how to undo it. */
export async function sendSubscriptionEndedEmail(opts: {
  to: string
  contractorId: string
  companyName?: string | null
  reason: 'canceled' | 'unpaid'
}) {
  const who = opts.companyName?.trim() || 'your account'
  return sendEmail({
    kind: 'billing.subscription_ended',
    to: opts.to,
    contractorId: opts.contractorId,
    idempotencyKey: `billing.subscription_ended:${opts.contractorId}:${opts.reason}:${new Date().toISOString().slice(0, 10)}`,
    subject: `${who} — your quote calculator has stopped`,
    html: renderEmail({
      heading: 'Your calculator has stopped accepting quotes',
      blocks: [
        {
          type: 'text',
          text:
            opts.reason === 'unpaid'
              ? `We tried for ${PAST_DUE_GRACE_DAYS} days to process payment for ${who} and could not. The calculator on your website is no longer accepting new quotes.`
              : `Your subscription for ${who} has been cancelled, so the calculator on your website is no longer accepting new quotes.`,
        },
        {
          type: 'text',
          text: 'Your settings, pricing and past leads are all still here. Restarting the subscription brings the calculator straight back — nothing needs rebuilding.',
        },
        { type: 'button', label: 'Restart my subscription', href: billingUrl() },
      ],
    }),
  })
}
