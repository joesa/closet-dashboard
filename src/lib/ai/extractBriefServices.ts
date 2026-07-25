/**
 * Deterministically pull sellable services named in a Full redesign admin seed
 * that are not already in intake. Models often miss these when the seed is
 * meta ("write a prompt for a wrapping + brakes shop…").
 */

export type ExtractedBriefService = {
  title: string
  description: string
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

function intakeCovers(intakeTitles: string[], title: string, extra?: RegExp): boolean {
  const n = norm(title)
  for (const raw of intakeTitles) {
    const t = norm(raw)
    if (!t) continue
    if (t === n || t.includes(n) || n.includes(t)) return true
    if (extra && extra.test(t)) return true
  }
  return false
}

/** Phrase → catalog title (+ description) when the brief names that offering. */
const SERVICE_PATTERNS: Array<{
  re: RegExp
  title: string
  description: string
  /** Extra intake match (e.g. oil change already covers "oil"). */
  intakeHint?: RegExp
}> = [
  {
    re: /\b((car|vehicle|auto|fleet|vinyl)\s+)?wrap(ping|s)?\b|\bcolor[\s-]?change\b|\bchrome\s+delete\b/i,
    title: 'Vehicle Wrapping',
    description:
      'Custom vinyl wraps, color-change film, and commercial lettering — measured, cut, and finished on-site or in bay.',
    intakeHint: /\bwrap|ppf|vinyl\b/i,
  },
  {
    re: /\bppf\b|\bpaint\s*protection\s*film\b/i,
    title: 'Paint Protection Film',
    description: 'Clear PPF for high-impact panels and full-front coverage.',
    intakeHint: /\bppf|paint protection\b/i,
  },
  {
    re: /\b(brake|brakes)\b/i,
    title: 'Brake Service',
    description: 'Pads, hardware, and hydraulic work diagnosed and repaired.',
    intakeHint: /\bbrake/i,
  },
  {
    re: /\b(rotor|rotors|rotter|rotters)\b/i,
    title: 'Rotor Service',
    description: 'Rotor resurfacing or replacement with matching pad work.',
    intakeHint: /\brotor/i,
  },
  {
    re: /\bengine\s+(fix(?:es)?|repair|work|service|diagnostic)/i,
    title: 'Engine Repair',
    description: 'Diagnostics and mechanical engine repair — not guesswork parts swaps.',
    intakeHint: /\bengine\b/i,
  },
  {
    re: /\boil(\s+change|\s+service)?\b/i,
    title: 'Oil Change',
    description: 'Oil and filter service with fluid top-offs.',
    intakeHint: /\boil\b/i,
  },
  {
    re: /\bfilters?\b/i,
    title: 'Filter Service',
    description: 'Oil, cabin, and air filter replacements as needed.',
    intakeHint: /\bfilter/i,
  },
  {
    re: /\b(transmission|trans)\s+(service|flush|repair)\b/i,
    title: 'Transmission Service',
    description: 'Transmission service and repair.',
    intakeHint: /\btransmission|trans\b/i,
  },
  {
    re: /\bsuspension\b|\bshocks?\b|\bstruts?\b/i,
    title: 'Suspension Service',
    description: 'Shocks, struts, and suspension repairs.',
    intakeHint: /\bsuspension|shock|strut/i,
  },
  {
    re: /\b(align(?:ment)?|wheel balance)\b/i,
    title: 'Alignment',
    description: 'Wheel alignment and balance.',
    intakeHint: /\balign/i,
  },
]

/**
 * Extract services named in the admin brief that are not already covered by
 * intake titles. Safe to call on empty briefs (returns []).
 */
export function extractServicesNamedInBrief(
  brief: string,
  intakeTitles: string[] = []
): ExtractedBriefService[] {
  const text = (brief || '').trim()
  if (!text) return []

  const out: ExtractedBriefService[] = []
  const seen = new Set<string>()

  const push = (title: string, description: string, intakeHint?: RegExp) => {
    const key = norm(title)
    if (seen.has(key)) return
    if (intakeCovers(intakeTitles, title, intakeHint)) return
    seen.add(key)
    out.push({ title, description })
  }

  for (const p of SERVICE_PATTERNS) {
    if (p.re.test(text)) {
      push(p.title, p.description, p.intakeHint)
    }
  }

  // "such as X, Y, and Z" / "including X, Y"
  const listMatch = text.match(
    /(?:such as|including|e\.g\.|eg\.|plus)\s+([^.;\n]+)/i
  )
  if (listMatch?.[1]) {
    const parts = listMatch[1]
      .split(/,|\/|&|\band\b/i)
      .map((s) => s.trim())
      .filter((s) => s.length > 2 && s.length < 48)
    for (const part of parts) {
      const cleaned = part
        .replace(/^(changing|change|fixing|fix|replacing|replace|doing)\s+/i, '')
        .trim()
      if (!cleaned) continue
      // Re-run patterns on the fragment for canonical titles
      let matched = false
      for (const p of SERVICE_PATTERNS) {
        if (p.re.test(cleaned) || p.re.test(part)) {
          push(p.title, p.description, p.intakeHint)
          matched = true
          break
        }
      }
      if (!matched && /wrap/i.test(cleaned)) {
        push(
          'Vehicle Wrapping',
          'Custom vinyl wraps and color-change film.',
          /\bwrap|ppf|vinyl\b/i
        )
      }
    }
  }

  return out
}

/**
 * Visible text of HTML for service matching — strips tags/attrs so CSS
 * classes like `.wrap` do not false-positive as "Vehicle Wrapping".
 */
function htmlTextContent(html: string): string {
  return (html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

/** True if page HTML already surfaces this service (title or wrap synonym). */
export function htmlMentionsService(html: string, title: string): boolean {
  const h = htmlTextContent(html)
  const t = norm(title)
  if (!h || !t) return false
  if (h.includes(t)) return true
  // Require real wrap *service* words — not the layout class "wrap".
  if (/\bwrap/.test(t)) {
    return /\b(wrapping|wraps|vinyl wrap|vehicle wrap|car wrap|fleet wrap|color[\s-]?change)\b/i.test(
      h
    )
  }
  if (/\bbrake/.test(t) && /\bbrake/.test(h)) return true
  if (/\brotor/.test(t) && /\brotor/.test(h)) return true
  if (/\bengine/.test(t) && /\bengine/.test(h)) return true
  // Token overlap: at least 2 significant words
  const tokens = t.split(/\s+/).filter((w) => w.length > 3)
  if (tokens.length >= 2 && tokens.every((w) => h.includes(w))) return true
  return false
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Inject missing brief-added services into home (and services page if present)
 * so catalog merges are visible on the custom site, not only in products_config.
 * Prefer appending into an existing ticket/service grid when present.
 */
export function injectMissingServicesIntoHtml(
  html: string,
  missing: ExtractedBriefService[]
): string {
  if (!html || !missing.length) return html

  const ticketCards = missing
    .map((s, i) => {
      const code = escapeHtml(
        s.title
          .replace(/[^a-zA-Z0-9]/g, '')
          .slice(0, 3)
          .toUpperCase() || `S${i + 1}`
      )
      return `<div class="ticket" data-brief-added="1"><span class="svc-code">${code}</span><h3>${escapeHtml(s.title)}</h3><p>${escapeHtml(s.description)}</p></div>`
    })
    .join('\n')

  const articleCards = missing
    .map(
      (s) =>
        `<article class="svc-card" data-brief-added="1"><h3>${escapeHtml(s.title)}</h3><p>${escapeHtml(s.description)}</p></article>`
    )
    .join('\n')

  // Append into the last ticket grid (common Full redesign pattern).
  const ticketOpen = html.search(/<div[^>]*class="[^"]*\btickets?\b[^"]*"/i)
  if (ticketOpen >= 0) {
    // Find closing of that tickets container: last </div> before next major section
    // after the tickets block — insert before the container's closing tag by
    // locating the end of the last .ticket sibling group.
    const lastTicket = html.toLowerCase().lastIndexOf('class="ticket"')
    if (lastTicket >= 0) {
      const afterLast = html.indexOf('</div>', lastTicket)
      if (afterLast >= 0) {
        const insertAt = afterLast + '</div>'.length
        return html.slice(0, insertAt) + '\n' + ticketCards + html.slice(insertAt)
      }
    }
  }

  const block = `\n<section class="services-brief-added" aria-label="Added services">\n${articleCards || ticketCards}\n</section>\n`

  // Prefer inserting before engagement mount / footer / end of main.
  const widgetIdx = html.search(/<!--\s*CLOSET_WIDGET|<!--\s*WIDGET/i)
  if (widgetIdx >= 0) {
    return html.slice(0, widgetIdx) + block + html.slice(widgetIdx)
  }
  const footerIdx = html.search(/<footer\b/i)
  if (footerIdx >= 0) {
    return html.slice(0, footerIdx) + block + html.slice(footerIdx)
  }
  const mainClose = html.search(/<\/main>/i)
  if (mainClose >= 0) {
    return html.slice(0, mainClose) + block + html.slice(mainClose)
  }
  return html + block
}
