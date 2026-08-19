import { renderEmail } from '@/lib/email/layout'
import { sendEmail } from '@/lib/email/send'
import { publicAppOrigin } from '@/lib/urls'

/**
 * The weekly "here is what your website brought in" email.
 *
 * Leads arrive one alert at a time and are never summarized, so a contractor
 * has no sense of whether the thing they pay for is working — which is exactly
 * the judgment they make at renewal. This is the one message that answers it.
 *
 * A week with no leads still gets an email. Silence is the case where the
 * customer most needs to hear from us, and hiding it would be flattering the
 * product at their expense.
 */

export type DigestLead = {
  first_name: string | null
  last_name: string | null
  email: string | null
  estimated_total: number | null
  created_at: string
  duplicate_of?: string | null
}

export type DigestSummary = {
  newLeads: number
  followUps: number
  quotedValue: number
  topLeads: Array<{ name: string; value: number | null }>
}

function displayName(lead: DigestLead): string {
  const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim()
  if (name) return name
  if (lead.email) return lead.email.split('@')[0]
  return 'Someone'
}

function money(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`
}

/**
 * Reduce a week of leads to the few numbers worth reading.
 * Pure, so the arithmetic can be tested without a database or an inbox.
 */
export function summarizeWeek(leads: DigestLead[]): DigestSummary {
  const distinct = leads.filter((lead) => !lead.duplicate_of)
  const quotedValue = distinct.reduce((sum, lead) => sum + (Number(lead.estimated_total) || 0), 0)

  const topLeads = [...distinct]
    .sort((a, b) => (Number(b.estimated_total) || 0) - (Number(a.estimated_total) || 0))
    .slice(0, 5)
    .map((lead) => ({
      name: displayName(lead),
      value: lead.estimated_total === null ? null : Number(lead.estimated_total),
    }))

  return {
    newLeads: distinct.length,
    followUps: leads.length - distinct.length,
    quotedValue,
    topLeads,
  }
}

/** Subject line. Leads with the number, because that is what gets it opened. */
export function digestSubject(summary: DigestSummary): string {
  if (summary.newLeads === 0) return 'No new leads last week'
  if (summary.newLeads === 1) return '1 new lead last week'
  return `${summary.newLeads} new leads last week`
}

export function renderDigest(opts: {
  companyName: string | null
  summary: DigestSummary
  weekLabel: string
}): string {
  const { summary } = opts
  const who = opts.companyName?.trim() || 'your business'

  if (summary.newLeads === 0) {
    return renderEmail({
      heading: 'No new leads last week',
      blocks: [
        {
          type: 'text',
          text: `Nobody completed the quote form on ${who}'s website during ${opts.weekLabel}. Your form is live and working — this is about traffic reaching it.`,
        },
        {
          type: 'note',
          text: 'The two things that move this most: making sure the quote form is on your busiest page, and sending your existing enquiries to it.',
        },
        { type: 'button', label: 'Check your setup', href: `${publicAppOrigin()}/dashboard` },
      ],
    })
  }

  const rows: Array<[string, string]> = [
    ['New leads', String(summary.newLeads)],
    ['Quoted value', money(summary.quotedValue)],
  ]
  if (summary.followUps > 0) {
    rows.push(['Follow-up submissions', String(summary.followUps)])
  }

  return renderEmail({
    heading: digestSubject(summary),
    blocks: [
      { type: 'text', text: `Here is what ${who}'s website brought in during ${opts.weekLabel}.` },
      { type: 'facts', rows },
      {
        type: 'text',
        text: summary.topLeads
          .map((lead) => (lead.value ? `${lead.name} — ${money(lead.value)}` : lead.name))
          .join('\n'),
      },
      { type: 'button', label: 'Open your leads', href: `${publicAppOrigin()}/dashboard/leads` },
      {
        type: 'note',
        text: 'Full details, phone numbers and a CSV export are on your leads page.',
      },
    ],
  })
}

/** Send one contractor's digest. Idempotency-keyed on the week. */
export async function sendLeadDigest(opts: {
  to: string
  contractorId: string
  companyName: string | null
  weekKey: string
  weekLabel: string
  leads: DigestLead[]
}) {
  const summary = summarizeWeek(opts.leads)
  return sendEmail({
    kind: 'lead.weekly_digest',
    to: opts.to,
    contractorId: opts.contractorId,
    // Re-running the cron in the same week must not mail twice.
    idempotencyKey: `lead-digest:${opts.contractorId}:${opts.weekKey}`,
    subject: digestSubject(summary),
    html: renderDigest({ companyName: opts.companyName, summary, weekLabel: opts.weekLabel }),
  })
}
