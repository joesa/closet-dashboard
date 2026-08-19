/**
 * One layout for every message the platform sends.
 *
 * Six call sites each hand-rolled their own HTML, so a contractor could receive
 * a lead alert, a launch email and a password reset that looked like three
 * different companies. Plain, readable markup rather than a template engine:
 * email clients punish cleverness, and this has to render in Outlook.
 */

export type EmailBlock =
  | { type: 'text'; text: string }
  | { type: 'button'; label: string; href: string }
  | { type: 'facts'; rows: Array<[string, string]> }
  | { type: 'note'; text: string }

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Renders a message body. `heading` is the one thing the reader must see. */
export function renderEmail(opts: {
  heading: string
  blocks: EmailBlock[]
  footer?: string
}): string {
  const body = opts.blocks
    .map((block) => {
      switch (block.type) {
        case 'text':
          return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1f2933">${escapeHtml(block.text)}</p>`
        case 'button':
          return `<p style="margin:0 0 20px"><a href="${escapeHtml(block.href)}" style="display:inline-block;padding:11px 20px;background:#0f172a;color:#ffffff;border-radius:6px;text-decoration:none;font-size:15px;font-weight:600">${escapeHtml(block.label)}</a></p>`
        case 'facts':
          return `<table style="margin:0 0 20px;border-collapse:collapse;font-size:15px;color:#1f2933">${block.rows
            .map(
              ([label, value]) =>
                `<tr><td style="padding:4px 16px 4px 0;color:#627787">${escapeHtml(label)}</td><td style="padding:4px 0;font-weight:600">${escapeHtml(value)}</td></tr>`
            )
            .join('')}</table>`
        case 'note':
          return `<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#627787">${escapeHtml(block.text)}</p>`
      }
    })
    .join('\n')

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f6f8;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px">
    <tr><td>
      <h1 style="margin:0 0 20px;font-size:20px;line-height:1.3;color:#0f172a">${escapeHtml(opts.heading)}</h1>
      ${body}
      <p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #e4e9ee;font-size:12px;color:#8a99a8">
        ${escapeHtml(opts.footer ?? 'DitchTheForm — reply to this email and a human will read it.')}
      </p>
    </td></tr>
  </table>
</body></html>`
}
